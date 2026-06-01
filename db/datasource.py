"""Read helpers that pull scoring data from Supabase.

Supabase caps a single ``select`` at 1000 rows, so list fetches paginate with
``.range()``. RERA projects (~9.6k) and OSM amenities (~27k) are cached per
process so they are pulled once, mirroring the previous in-memory JSON loads.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from .supabase_client import get_supabase

PAGE_SIZE = 1000

SCORES_TABLE = "localities"
RERA_TABLE = "rera_projects"
OSM_TABLE = "osm_amenities"


def _fetch_all(table: str, columns: str) -> list[dict[str, Any]]:
    client = get_supabase()
    if client is None:
        raise RuntimeError("Supabase is not configured (SUPABASE_URL / SUPABASE_KEY).")

    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        end = start + PAGE_SIZE - 1
        response = client.table(table).select(columns).range(start, end).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        start += PAGE_SIZE
    return rows


def fetch_scores() -> list[dict[str, Any]]:
    """Pre-scored localities for the /localities endpoint (not cached: small + may change)."""
    return _fetch_all(
        SCORES_TABLE,
        "locality,neighbourhood_score,rera_score,amenity_score",
    )


@lru_cache(maxsize=1)
def fetch_rera_projects() -> list[dict[str, Any]]:
    return _fetch_all(RERA_TABLE, "locality,project_name,complaints_count")


@lru_cache(maxsize=1)
def fetch_osm_amenities() -> list[dict[str, Any]]:
    return _fetch_all(OSM_TABLE, "lat,lon,amenity,name,tags")


def clear_caches() -> None:
    fetch_rera_projects.cache_clear()
    fetch_osm_amenities.cache_clear()
