"""Fetch Bangalore amenities from OpenStreetMap via the Overpass API."""

from __future__ import annotations

import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

# Bangalore Urban approximate bounding box (south, west, north, east)
BANGALORE_BBOX = {
    "south": 12.7343,
    "west": 77.3795,
    "north": 13.1736,
    "east": 77.8826,
}

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "data" / "raw" / "osm_bangalore.json"

OVERPASS_QUERY = """
[out:json][timeout:180];
(
  node["amenity"]({south},{west},{north},{east});
  way["amenity"]({south},{west},{north},{east});
  relation["amenity"]({south},{west},{north},{east});
);
out center tags;
"""


def build_query(bbox: dict[str, float]) -> str:
    return OVERPASS_QUERY.format(**bbox).strip()


def fetch_overpass(
    bbox: dict[str, float] | None = None,
    max_retries: int = 3,
) -> dict[str, Any]:
    """Query Overpass API with retry and endpoint fallback."""
    bbox = bbox or BANGALORE_BBOX
    query = build_query(bbox)
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        endpoint = OVERPASS_ENDPOINTS[(attempt - 1) % len(OVERPASS_ENDPOINTS)]
        try:
            response = requests.post(
                endpoint,
                data={"data": query},
                headers={"User-Agent": "RealEstateResearch/1.0 (Bangalore OSM pipeline)"},
                timeout=200,
            )
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < max_retries:
                delay = random.uniform(2, 4)
                time.sleep(delay)

    raise RuntimeError(f"Overpass API failed after {max_retries} attempts: {last_error}")


def normalize_element(element: dict[str, Any]) -> dict[str, Any]:
    """Flatten an OSM element into a consistent record."""
    tags = element.get("tags") or {}
    lat = element.get("lat")
    lon = element.get("lon")

    if lat is None or lon is None:
        center = element.get("center") or {}
        lat = center.get("lat")
        lon = center.get("lon")

    return {
        "osm_id": element.get("id"),
        "osm_type": element.get("type"),
        "amenity": tags.get("amenity"),
        "name": tags.get("name"),
        "lat": lat,
        "lon": lon,
        "tags": tags,
    }


def run(output_path: Path | str = DEFAULT_OUTPUT) -> dict[str, Any]:
    """Fetch amenities and save to JSON."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    raw = fetch_overpass()
    elements = raw.get("elements", [])
    amenities = [normalize_element(el) for el in elements if el.get("tags", {}).get("amenity")]

    payload = {
        "source": "OpenStreetMap Overpass API",
        "bbox": BANGALORE_BBOX,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "count": len(amenities),
        "amenities": amenities,
    }

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(amenities)} amenities to {output_path}")
    return payload


if __name__ == "__main__":
    run()
