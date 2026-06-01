"""Fetch Karnataka RERA project listing via requests + BeautifulSoup."""

from __future__ import annotations

import json
import random
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup

RERA_URL = "https://rera.karnataka.gov.in/viewAllProjects"
RAW_HTML_PATH = Path(__file__).resolve().parent.parent / "data" / "raw" / "rera_raw.html"
JSON_OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "raw" / "rera_projects.json"

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Referer": "https://rera.karnataka.gov.in/",
}


def fetch_html(
    url: str = RERA_URL,
    params: dict[str, str] | None = None,
    max_retries: int = 3,
) -> str:
    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.get(
                url,
                params=params or {"language": "en"},
                headers=BROWSER_HEADERS,
                timeout=60,
            )
            response.raise_for_status()
            return response.text
        except requests.RequestException as exc:
            last_error = exc
            if attempt < max_retries:
                time.sleep(random.uniform(2, 3))
    raise RuntimeError(f"RERA fetch failed after {max_retries} attempts: {last_error}")


def extract_js_array(html: str, array_name: str) -> list[str]:
    # Prevent applicationNameList matching applicationNameList2/3/4
    if array_name == "applicationNameList":
        name_pattern = r"applicationNameList(?!\d)"
    else:
        name_pattern = re.escape(array_name)

    pattern = re.compile(
        rf"{name_pattern}\s*\.\s*push\s*\(\s*['\"](.*?)['\"]\s*\)",
        re.DOTALL,
    )
    return [v.replace("\\'", "'").replace('\\"', '"') for v in pattern.findall(html)]


def parse_projects(html: str) -> list[dict[str, Any]]:
    """
    K-RERA embeds project rows in inline JS arrays (multiline .push format):
      applicationNameList  -> application/ack number
      applicationNameList2 -> RERA registration number
      applicationNameList3 -> project name
      applicationNameList4 -> promoter name

    Locality, status, and complaints are not present on the listing page;
    they require separate detail/complaint endpoints.
    """
    ack_numbers = extract_js_array(html, "applicationNameList")
    rera_numbers = extract_js_array(html, "applicationNameList2")
    project_names = extract_js_array(html, "applicationNameList3")
    promoters = extract_js_array(html, "applicationNameList4")

    max_len = max([len(ack_numbers), len(rera_numbers), len(project_names), len(promoters)], default=0)
    projects: list[dict[str, Any]] = []

    for i in range(max_len):
        record = {
            "ack_number": ack_numbers[i] if i < len(ack_numbers) else "",
            "rera_number": rera_numbers[i] if i < len(rera_numbers) else "",
            "project_name": project_names[i] if i < len(project_names) else "",
            "promoter": promoters[i] if i < len(promoters) else "",
            "locality": None,
            "project_status": None,
            "complaints_count": None,
        }
        if record["project_name"] or record["rera_number"]:
            projects.append(record)

    if projects:
        return projects

    return parse_projects_from_tables(html)


def parse_projects_from_tables(html: str) -> list[dict[str, Any]]:
    """Fallback: parse HTML tables if JS arrays are absent."""
    soup = BeautifulSoup(html, "lxml")
    projects: list[dict[str, Any]] = []
    keywords = ("project", "promoter", "rera", "registration", "status", "complaint")

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        headers = [cell.get_text(strip=True).lower() for cell in rows[0].find_all(["th", "td"])]
        if not any(any(kw in h for kw in keywords) for h in headers):
            continue

        for row in rows[1:]:
            cells = [cell.get_text(strip=True) for cell in row.find_all("td")]
            if len(cells) < 2:
                continue
            entry: dict[str, Any] = {}
            for idx, value in enumerate(cells):
                header = headers[idx] if idx < len(headers) else f"col_{idx}"
                key = re.sub(r"[^a-z0-9_]+", "_", header.lower()).strip("_")
                entry[key] = value
            projects.append(entry)

    return projects


def run(
    raw_html_path: Path | str = RAW_HTML_PATH,
    json_output_path: Path | str = JSON_OUTPUT_PATH,
    enrich: bool = True,
) -> dict[str, Any]:
    raw_html_path = Path(raw_html_path)
    json_output_path = Path(json_output_path)
    raw_html_path.parent.mkdir(parents=True, exist_ok=True)

    html = fetch_html()
    raw_html_path.write_text(html, encoding="utf-8")
    print(f"Saved raw HTML ({len(html):,} bytes) to {raw_html_path}")

    projects = parse_projects(html)

    if enrich:
        try:
            from scrapers.rera_complaints import enrich_projects, run as run_complaints
        except ModuleNotFoundError:
            from rera_complaints import enrich_projects, run as run_complaints

        complaints_data = run_complaints()
        projects = enrich_projects(
            projects,
            complaints_data["complaint_counts"],
            complaints_data["renewal_enrichment"],
        )

    payload = {
        "source": "Karnataka RERA",
        "source_url": RERA_URL,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "count": len(projects),
        "notes": (
            "Projects from viewAllProjects, enriched with complaints_count "
            "(projectComplaintReport + viewAllComplaints), locality and project_status "
            "(viewRenewalProjects)."
        ),
        "projects": projects,
    }

    with json_output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Parsed {len(projects)} projects to {json_output_path}")
    return payload


if __name__ == "__main__":
    run()
