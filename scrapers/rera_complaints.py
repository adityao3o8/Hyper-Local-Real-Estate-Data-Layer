"""Fetch and parse Karnataka RERA complaint data to enrich project records."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup

try:
    from scrapers.rera_karnataka import BROWSER_HEADERS, extract_js_array, fetch_html
except ModuleNotFoundError:
    from rera_karnataka import BROWSER_HEADERS, extract_js_array, fetch_html

COMPLAINTS_URL = "https://rera.karnataka.gov.in/viewAllComplaints"
COMPLAINT_REPORT_URL = "https://rera.karnataka.gov.in/projectComplaintReport"
RENEWAL_URL = "https://rera.karnataka.gov.in/viewRenewalProjects"

RAW_COMPLAINTS_HTML = Path(__file__).resolve().parent.parent / "data" / "raw" / "rera_complaints_raw.html"
RAW_RENEWAL_HTML = Path(__file__).resolve().parent.parent / "data" / "raw" / "rera_renewal_raw.html"
COMPLAINTS_JSON = Path(__file__).resolve().parent.parent / "data" / "raw" / "rera_complaints.json"


def normalize_key(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).upper()


def parse_complaint_records(html: str) -> list[dict[str, Any]]:
    """Parse individual complaints from viewAllComplaints JS arrays."""
    complaint_numbers = extract_js_array(html, "applicationNameList2")
    project_names = extract_js_array(html, "applicationNameList3")
    promoters = extract_js_array(html, "applicationNameList4")

    max_len = max([len(complaint_numbers), len(project_names), len(promoters)], default=0)
    records: list[dict[str, Any]] = []

    for i in range(max_len):
        record = {
            "complaint_number": complaint_numbers[i] if i < len(complaint_numbers) else "",
            "project_name": project_names[i] if i < len(project_names) else "",
            "promoter": promoters[i] if i < len(promoters) else "",
        }
        if record["complaint_number"] or record["project_name"]:
            records.append(record)

    return records


def parse_complaint_report_table(html: str) -> dict[str, int]:
    """Parse projectComplaintReport table: project name -> complaint count."""
    soup = BeautifulSoup(html, "lxml")
    counts: dict[str, int] = {}

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        headers = [cell.get_text(strip=True).upper() for cell in rows[0].find_all(["th", "td"])]
        if "PROJECT NAME" not in headers or "NO OF COMPLAINTS" not in headers:
            continue

        project_idx = headers.index("PROJECT NAME")
        count_idx = headers.index("NO OF COMPLAINTS")

        for row in rows[1:]:
            cells = [cell.get_text(strip=True) for cell in row.find_all("td")]
            if len(cells) <= max(project_idx, count_idx):
                continue
            project = cells[project_idx]
            if not project:
                continue
            try:
                counts[normalize_key(project)] = int(cells[count_idx])
            except ValueError:
                counts[normalize_key(project)] = 0

    return counts


def parse_renewal_enrichment(html: str) -> dict[str, dict[str, Any]]:
    """
    Parse viewRenewalProjects tables for district (locality) and status.
    Returns dict keyed by normalized project name and rera registration number.
    """
    soup = BeautifulSoup(html, "lxml")
    enrichment: dict[str, dict[str, Any]] = {}

    def store(key: str, locality: str, status: str, rera_number: str = "") -> None:
        if not key:
            return
        existing = enrichment.get(key, {})
        enrichment[key] = {
            "locality": locality or existing.get("locality"),
            "project_status": status or existing.get("project_status"),
            "rera_number": rera_number or existing.get("rera_number"),
        }

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        headers = [cell.get_text(strip=True).upper() for cell in rows[0].find_all(["th", "td"])]

        if "PROJECT" in headers and "DISTRICT" in headers and "NEW REGISTRATION NO" in headers:
            # Approved extensions
            project_idx = headers.index("PROJECT")
            district_idx = headers.index("DISTRICT")
            reg_idx = headers.index("NEW REGISTRATION NO")
            for row in rows[1:]:
                cells = [cell.get_text(strip=True) for cell in row.find_all("td")]
                if len(cells) <= max(project_idx, district_idx, reg_idx):
                    continue
                project = cells[project_idx]
                district = cells[district_idx]
                rera = cells[reg_idx]
                store(normalize_key(project), district, "Extension Approved", rera)
                if rera:
                    store(normalize_key(rera), district, "Extension Approved", rera)

        elif "PROJECT" in headers and "DISTRICT" in headers and "REJECTED ON" in headers:
            # Rejected extensions
            project_idx = headers.index("PROJECT")
            district_idx = headers.index("DISTRICT")
            reg_idx = headers.index("REGISTRATION NO")
            for row in rows[1:]:
                cells = [cell.get_text(strip=True) for cell in row.find_all("td")]
                if len(cells) <= max(project_idx, district_idx, reg_idx):
                    continue
                project = cells[project_idx]
                district = cells[district_idx]
                rera = cells[reg_idx]
                store(normalize_key(project), district, "Extension Rejected", rera)
                if rera:
                    store(normalize_key(rera), district, "Extension Rejected", rera)

    return enrichment


def aggregate_complaint_counts(records: list[dict[str, Any]]) -> dict[str, int]:
    counter: Counter[str] = Counter()
    for record in records:
        key = normalize_key(record.get("project_name"))
        if key:
            counter[key] += 1
    return dict(counter)


def enrich_projects(
    projects: list[dict[str, Any]],
    complaint_counts: dict[str, int],
    renewal_data: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """Merge complaint counts, locality, and status into project records."""
    enriched: list[dict[str, Any]] = []

    for project in projects:
        record = dict(project)
        project_key = normalize_key(record.get("project_name"))
        rera_key = normalize_key(record.get("rera_number"))

        renewal = renewal_data.get(project_key) or renewal_data.get(rera_key) or {}

        record["locality"] = renewal.get("locality")
        record["project_status"] = renewal.get("project_status") or "Registered"
        record["complaints_count"] = complaint_counts.get(project_key, 0)

        enriched.append(record)

    return enriched


def run(
    raw_complaints_path: Path | str = RAW_COMPLAINTS_HTML,
    raw_renewal_path: Path | str = RAW_RENEWAL_HTML,
    json_output_path: Path | str = COMPLAINTS_JSON,
) -> dict[str, Any]:
    raw_complaints_path = Path(raw_complaints_path)
    raw_renewal_path = Path(raw_renewal_path)
    json_output_path = Path(json_output_path)
    raw_complaints_path.parent.mkdir(parents=True, exist_ok=True)

    complaints_html = fetch_html(COMPLAINTS_URL)
    raw_complaints_path.write_text(complaints_html, encoding="utf-8")
    print(f"Saved complaints HTML ({len(complaints_html):,} bytes) to {raw_complaints_path}")

    report_html = fetch_html(COMPLAINT_REPORT_URL)
    renewal_html = fetch_html(RENEWAL_URL)
    raw_renewal_path.write_text(renewal_html, encoding="utf-8")
    print(f"Saved renewal HTML ({len(renewal_html):,} bytes) to {raw_renewal_path}")

    complaint_records = parse_complaint_records(complaints_html)
    report_counts = parse_complaint_report_table(report_html)
    aggregated_counts = aggregate_complaint_counts(complaint_records)
    renewal_data = parse_renewal_enrichment(renewal_html)

    # Prefer official report counts; fall back to aggregated complaint records
    merged_counts = {**aggregated_counts, **report_counts}

    payload = {
        "source": "Karnataka RERA Complaints",
        "source_urls": [COMPLAINTS_URL, COMPLAINT_REPORT_URL, RENEWAL_URL],
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "complaint_records_count": len(complaint_records),
        "projects_with_complaints": len(merged_counts),
        "renewal_records_count": len(renewal_data),
        "complaint_counts": merged_counts,
        "renewal_enrichment": renewal_data,
        "complaint_records_sample": complaint_records[:10],
    }

    with json_output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(
        f"Parsed {len(complaint_records)} complaints, "
        f"{len(merged_counts)} projects with counts, "
        f"{len(renewal_data)} renewal enrichment keys"
    )
    return payload


if __name__ == "__main__":
    run()
