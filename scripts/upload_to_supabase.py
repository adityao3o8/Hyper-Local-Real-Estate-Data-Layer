"""Upload the local JSON datasets into Supabase tables.

Prerequisites:
    1. Run db/schema.sql in the Supabase SQL editor.
    2. Set SUPABASE_URL and SUPABASE_KEY (service_role key) in the root .env.
    3. pip install -r requirements.txt

Usage:
    python scripts/upload_to_supabase.py                # upload all three tables
    python scripts/upload_to_supabase.py --only localities
    python scripts/upload_to_supabase.py --truncate     # delete rows before insert
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterable

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

from db.datasource import OSM_TABLE, RERA_TABLE, SCORES_TABLE  # noqa: E402
from db.supabase_client import get_supabase  # noqa: E402

RERA_PATH = ROOT / "data" / "raw" / "rera_projects.json"
OSM_PATH = ROOT / "data" / "raw" / "osm_bangalore.json"
SCORES_PATH = ROOT / "data" / "scores_bangalore.json"

BATCH_SIZE = 500


def _chunks(rows: list[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def _insert(table: str, rows: list[dict[str, Any]]) -> None:
    client = get_supabase()
    if client is None:
        raise SystemExit("Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in .env.")

    total = len(rows)
    done = 0
    for batch in _chunks(rows, BATCH_SIZE):
        client.table(table).insert(batch).execute()
        done += len(batch)
        print(f"  {table}: {done}/{total}", flush=True)


def _truncate(table: str) -> None:
    client = get_supabase()
    if client is None:
        return
    # delete-all needs a filter; "id is not null" matches every row.
    if table == SCORES_TABLE:
        client.table(table).delete().neq("locality", "").execute()
    else:
        client.table(table).delete().neq("id", 0).execute()
    print(f"  truncated {table}")


def build_scores_rows() -> list[dict[str, Any]]:
    data = json.loads(SCORES_PATH.read_text(encoding="utf-8"))
    rows = []
    for entry in data.get("scores", []):
        if "error" in entry:
            continue
        rows.append(
            {
                "locality": entry["locality"],
                "neighbourhood_score": entry.get("neighbourhood_score"),
                "rera_score": entry.get("rera_score"),
                "amenity_score": entry.get("amenity_score"),
                "payload": entry,
            }
        )
    return rows


def build_rera_rows() -> list[dict[str, Any]]:
    data = json.loads(RERA_PATH.read_text(encoding="utf-8"))
    rows = []
    for project in data.get("projects", []):
        rows.append(
            {
                "locality": project.get("locality"),
                "project_name": project.get("project_name"),
                "complaints_count": project.get("complaints_count") or 0,
                "payload": project,
            }
        )
    return rows


def build_osm_rows() -> list[dict[str, Any]]:
    data = json.loads(OSM_PATH.read_text(encoding="utf-8"))
    rows = []
    for record in data.get("amenities", []):
        rows.append(
            {
                "lat": record.get("lat"),
                "lon": record.get("lon"),
                "amenity": record.get("amenity"),
                "name": record.get("name"),
                "tags": record.get("tags") or {},
            }
        )
    return rows


BUILDERS = {
    "localities": (SCORES_TABLE, build_scores_rows),
    "rera": (RERA_TABLE, build_rera_rows),
    "osm": (OSM_TABLE, build_osm_rows),
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload local JSON datasets into Supabase")
    parser.add_argument(
        "--only",
        choices=sorted(BUILDERS),
        help="Upload a single dataset instead of all three",
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Delete existing rows in the target table(s) before inserting",
    )
    args = parser.parse_args()

    targets = [args.only] if args.only else list(BUILDERS)

    for key in targets:
        table, builder = BUILDERS[key]
        rows = builder()
        print(f"{key}: {len(rows)} rows -> {table}")
        if args.truncate:
            _truncate(table)
        _insert(table, rows)

    print("Done.")


if __name__ == "__main__":
    main()
