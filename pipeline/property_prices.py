"""Fetch indicative property prices via SerpAPI (Google → MagicBricks snippets)."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

SERPAPI_URL = "https://serpapi.com/search.json"
DEFAULT_SITE = "magicbricks.com"


@dataclass
class ParsedPrice:
    raw: str
    amount_inr: float | None
    unit: str  # total | per_sqft | unknown
    source_title: str
    source_link: str
    snippet: str


@dataclass
class PropertyPriceResult:
    locality: str
    query: str
    prices: list[ParsedPrice] = field(default_factory=list)
    organic_results: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None


# Indian property price patterns (order matters — more specific first)
_PRICE_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "per_sqft",
        re.compile(
            r"(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)\s*(?:/|per)\s*sq\.?\s*ft",
            re.IGNORECASE,
        ),
    ),
    (
        "per_sqft_rev",
        re.compile(
            r"([\d,]+(?:\.\d+)?)\s*(?:/|per)\s*sq\.?\s*ft",
            re.IGNORECASE,
        ),
    ),
    (
        "crore",
        re.compile(
            r"(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)\s*(?:Cr|Crore|crores?)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "lakh",
        re.compile(
            r"(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)\s*(?:L|Lakh|Lac|lakhs?)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "rupees_large",
        re.compile(
            r"(?:₹|Rs\.?|INR)\s*([\d,]{7,}(?:\.\d+)?)\b",
            re.IGNORECASE,
        ),
    ),
]


def _parse_amount(s: str) -> float:
    return float(s.replace(",", ""))


def _to_inr(amount: float, unit: str) -> float | None:
    if unit == "crore":
        return amount * 10_000_000
    if unit == "lakh":
        return amount * 100_000
    if unit in ("per_sqft", "per_sqft_rev", "rupees_large"):
        return amount
    return None


def build_magicbricks_query(locality: str, site: str = DEFAULT_SITE) -> str:
    return f"average property price {locality.strip()} Bangalore site:{site}"


def get_serpapi_key() -> str:
    key = os.getenv("SERPAPI_KEY") or os.getenv("SERP_API_KEY")
    if not key:
        raise ValueError(
            "SERPAPI_KEY not set. Sign up at https://serpapi.com and add SERPAPI_KEY to .env"
        )
    return key


def serpapi_google_search(query: str, api_key: str | None = None) -> dict[str, Any]:
    key = api_key or get_serpapi_key()
    response = requests.get(
        SERPAPI_URL,
        params={"engine": "google", "q": query, "api_key": key, "gl": "in", "hl": "en"},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def parse_prices_from_text(
    text: str,
    *,
    source_title: str = "",
    source_link: str = "",
) -> list[ParsedPrice]:
    """Extract price mentions from a Google result snippet or title."""
    found: list[ParsedPrice] = []
    seen: set[str] = set()

    for unit_key, pattern in _PRICE_PATTERNS:
        for match in pattern.finditer(text):
            raw = match.group(0).strip()
            if raw in seen:
                continue
            seen.add(raw)
            try:
                amount = _parse_amount(match.group(1))
            except (ValueError, IndexError):
                continue

            unit = "per_sqft" if "sq" in unit_key else (
                "total" if unit_key in ("crore", "lakh", "rupees_large") else "unknown"
            )
            inr = _to_inr(amount, unit_key if unit != "per_sqft" else unit_key)

            found.append(
                ParsedPrice(
                    raw=raw,
                    amount_inr=round(inr, 2) if inr is not None else None,
                    unit=unit,
                    source_title=source_title,
                    source_link=source_link,
                    snippet=text[:500],
                )
            )

    return found


def fetch_property_prices(
    locality: str,
    *,
    site: str = DEFAULT_SITE,
    api_key: str | None = None,
    max_results: int = 10,
) -> PropertyPriceResult:
    query = build_magicbricks_query(locality, site=site)
    result = PropertyPriceResult(locality=locality, query=query)

    try:
        data = serpapi_google_search(query, api_key=api_key)
    except requests.HTTPError as exc:
        result.error = f"SerpAPI HTTP error: {exc}"
        return result
    except Exception as exc:
        result.error = str(exc)
        return result

    organic = data.get("organic_results") or []
    result.organic_results = [
        {
            "title": r.get("title"),
            "link": r.get("link"),
            "snippet": r.get("snippet"),
        }
        for r in organic[:max_results]
    ]

    all_prices: list[ParsedPrice] = []
    for row in organic[:max_results]:
        title = row.get("title") or ""
        link = row.get("link") or ""
        snippet = row.get("snippet") or ""
        combined = f"{title}. {snippet}"
        all_prices.extend(
            parse_prices_from_text(
                combined,
                source_title=title,
                source_link=link,
            )
        )

    # Prefer MagicBricks links, then dedupe by raw string
    magicbricks = [p for p in all_prices if "magicbricks" in p.source_link.lower()]
    pool = magicbricks if magicbricks else all_prices
    deduped: list[ParsedPrice] = []
    seen_raw: set[str] = set()
    for p in pool:
        if p.raw not in seen_raw:
            seen_raw.add(p.raw)
            deduped.append(p)

    result.prices = deduped
    return result


def summarize_prices(result: PropertyPriceResult) -> dict[str, Any]:
    """Aggregate parsed prices for API / report consumption."""
    totals = [p for p in result.prices if p.unit == "total" and p.amount_inr]
    per_sqft = [p for p in result.prices if p.unit == "per_sqft" and p.amount_inr]

    out: dict[str, Any] = {
        "locality": result.locality,
        "query": result.query,
        "source": "serpapi_google_magicbricks",
        "price_mentions": [
            {
                "raw": p.raw,
                "amount_inr": p.amount_inr,
                "unit": p.unit,
                "source_title": p.source_title,
                "source_link": p.source_link,
            }
            for p in result.prices
        ],
        "organic_results": result.organic_results,
    }

    if totals:
        amounts = [p.amount_inr for p in totals if p.amount_inr is not None]
        out["total_price_inr"] = {
            "min": min(amounts),
            "max": max(amounts),
            "median": sorted(amounts)[len(amounts) // 2],
            "sample_count": len(amounts),
        }

    if per_sqft:
        amounts = [p.amount_inr for p in per_sqft if p.amount_inr is not None]
        out["per_sqft_inr"] = {
            "min": min(amounts),
            "max": max(amounts),
            "median": sorted(amounts)[len(amounts) // 2],
            "sample_count": len(amounts),
        }

    if result.error:
        out["error"] = result.error

    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Query SerpAPI for MagicBricks price snippets")
    parser.add_argument("locality", nargs="?", default="Indiranagar")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    result = fetch_property_prices(args.locality)
    summary = summarize_prices(result)

    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(f"Query: {summary['query']}\n")
        if summary.get("error"):
            print(f"Error: {summary['error']}")
        for p in summary.get("price_mentions", []):
            print(f"  • {p['raw']}")
            if p.get("amount_inr"):
                print(f"    → ₹{p['amount_inr']:,.0f} ({p['unit']})")
            print(f"    {p['source_link'][:80]}...")
        if summary.get("total_price_inr"):
            t = summary["total_price_inr"]
            print(f"\nTotal (from snippets): ₹{t['min']:,.0f} – ₹{t['max']:,.0f} (median ₹{t['median']:,.0f})")


if __name__ == "__main__":
    main()
