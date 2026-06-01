"""Generate plain-English neighbourhood reports from score JSON via Groq API."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SCORES_PATH = ROOT / "data" / "scores_bangalore.json"
MODEL = "llama-3.1-8b-instant"

SYSTEM_PROMPT = """You write concise neighbourhood guides for homebuyers in Bangalore, India.
Given structured score data (RERA complaints, nearby amenities), write exactly one paragraph
of plain English, approximately 150 words. Be factual, balanced, and practical — mention
strengths and weaknesses. Do not use bullet points, headers, or markdown. Do not invent
data beyond what is provided."""


def load_score(scores_path: Path, locality: str | None = None) -> dict[str, Any]:
    data = json.loads(scores_path.read_text(encoding="utf-8"))
    scores = data.get("scores", data)

    if locality:
        key = locality.strip().lower()
        for entry in scores:
            if entry.get("locality", "").lower() == key:
                return entry
        raise ValueError(f"Locality '{locality}' not found in {scores_path}")

    if isinstance(scores, list) and len(scores) == 1:
        return scores[0]
    raise ValueError("Provide --locality when scores file contains multiple entries")


def build_user_prompt(score: dict[str, Any]) -> str:
    return f"""Write a ~150-word neighbourhood report for a homebuyer considering {score['locality']}, Bangalore.

Score data:
{json.dumps(score, indent=2)}

Cover: overall score, RERA/developer track record (complaints), nearby amenities (hospitals, schools, parks, metro within 3km), and a balanced recommendation."""


def generate_report(score: dict[str, Any], api_key: str) -> str:
    try:
        from groq import Groq
    except ImportError as exc:
        raise ImportError("Install groq: pip install groq") from exc

    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=400,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(score)},
        ],
    )
    return (response.choices[0].message.content or "").strip()


def generate_reports_for_all(
    scores_path: Path,
    api_key: str,
    output_path: Path | None = None,
) -> list[dict[str, Any]]:
    data = json.loads(scores_path.read_text(encoding="utf-8"))
    scores = data.get("scores", [])
    reports: list[dict[str, Any]] = []

    for entry in scores:
        if "error" in entry:
            reports.append({"locality": entry["locality"], "error": entry["error"]})
            continue
        text = generate_report(entry, api_key)
        reports.append({"locality": entry["locality"], "report": text, "score": entry})

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps({"reports": reports}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    return reports


def main() -> None:
    load_dotenv(ROOT / ".env")

    parser = argparse.ArgumentParser(description="Generate neighbourhood report from score JSON")
    parser.add_argument(
        "--scores",
        type=Path,
        default=DEFAULT_SCORES_PATH,
        help="Path to scores JSON file",
    )
    parser.add_argument("--locality", help="Locality name to report on (required if multiple scores)")
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional path to save report JSON (use with --all)",
    )
    parser.add_argument("--all", action="store_true", help="Generate reports for all localities in scores file")
    args = parser.parse_args()

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("Error: GROQ_API_KEY not set. Add it to .env in the project root.", file=sys.stderr)
        sys.exit(1)

    if args.all:
        reports = generate_reports_for_all(args.scores, api_key, args.output)
        for item in reports:
            print(f"\n{'='*60}\n{item['locality']}\n{'='*60}")
            if "error" in item:
                print(f"Error: {item['error']}")
            else:
                print(item["report"])
        if args.output:
            print(f"\nSaved reports to {args.output}")
        return

    score = load_score(args.scores, args.locality)
    report = generate_report(score, api_key)
    print(report)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps({"locality": score["locality"], "report": report, "score": score}, indent=2),
            encoding="utf-8",
        )
        print(f"\nSaved to {args.output}")


if __name__ == "__main__":
    main()
