"""
Neighbourhood Score (0-100) from RERA project complaints and nearby OSM amenities.

Usage:
    python pipeline/scorer.py "Indiranagar"
    python pipeline/scorer.py "Bengaluru Urban"
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from fuzzywuzzy import fuzz

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

RERA_PATH = ROOT / "data" / "raw" / "rera_projects.json"
OSM_PATH = ROOT / "data" / "raw" / "osm_bangalore.json"
SCORES_PATH = ROOT / "data" / "scores_bangalore.json"

load_dotenv(ROOT / ".env")


def _supabase_enabled() -> bool:
    try:
        from db.supabase_client import supabase_enabled

        return supabase_enabled()
    except Exception:
        return False

OSM_LOCALITY_TAG_KEYS = (
    "addr:suburb",
    "addr:neighbourhood",
    "addr:neighborhood",
    "addr:quarter",
    "addr:city_district",
    "addr:place",
    "suburb",
)

RADIUS_KM = 3.0
NOMINATIM_DELAY_SEC = 1.1
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

HOSPITAL_TYPES = {"hospital", "clinic", "doctors"}
SCHOOL_TYPES = {"school", "college", "university", "kindergarten"}

# partial_ratio: "Indiranagar" vs "Bengaluru Urban - Indiranagar"
FUZZY_LOCALITY_THRESHOLD = 85


@dataclass
class AmenityCounts:
    hospital: int = 0
    school: int = 0
    park: int = 0
    metro: int = 0

    @property
    def total(self) -> int:
        return self.hospital + self.school + self.park + self.metro


@dataclass
class ScoreResult:
    locality: str
    centre_lat: float
    centre_lon: float
    rera_score: float
    amenity_score: float
    neighbourhood_score: float
    rera_projects_matched: int
    avg_complaints: float | None
    amenity_counts: AmenityCounts
    details: dict[str, Any] = field(default_factory=dict)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def normalize_locality(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip()).upper()


def _rera_haystack(project: dict[str, Any]) -> str:
    """Fields used to match a user locality against RERA records."""
    parts = [
        project.get("locality") or "",
        project.get("project_name") or "",
    ]
    return normalize_locality(" ".join(parts))


def _locality_segments(text: str) -> list[str]:
    """Split composite RERA locality strings (e.g. 'Bengaluru Urban - Indiranagar')."""
    normalized = normalize_locality(text)
    if not normalized:
        return []
    segments = {normalized}
    for part in re.split(r"\s*[-–—/|,]\s*", normalized):
        part = part.strip()
        if len(part) > 2:
            segments.add(part)
    return list(segments)


def fuzzy_locality_matches(query: str, haystack: str, threshold: int = FUZZY_LOCALITY_THRESHOLD) -> bool:
    """True when query matches haystack via substring or fuzzywuzzy partial ratio."""
    query = normalize_locality(query)
    haystack = normalize_locality(haystack)
    if not query or not haystack:
        return False

    if query in haystack or haystack in query:
        return True

    if fuzz.partial_ratio(query, haystack) >= threshold:
        return True

    for segment in _locality_segments(haystack):
        if query == segment:
            return True
        if query in segment or segment in query:
            return True
        if fuzz.partial_ratio(query, segment) >= threshold:
            return True
        if fuzz.token_set_ratio(query, segment) >= threshold:
            return True

    return False


def geocode_locality(locality: str) -> tuple[float, float, str]:
    """Resolve locality to lat/lon via Nominatim."""
    queries = [
        f"{locality}, Bengaluru, Karnataka, India",
        f"{locality}, Bangalore, Karnataka, India",
        f"{locality}, Karnataka, India",
    ]
    headers = {"User-Agent": "RealEstateNeighbourhoodScorer/1.0"}

    for query in queries:
        response = requests.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1},
            headers=headers,
            timeout=20,
        )
        response.raise_for_status()
        results = response.json()
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"]), results[0].get("display_name", query)

    raise ValueError(f"Could not geocode locality: {locality}")


def load_rera_projects(path: Path = RERA_PATH) -> list[dict[str, Any]]:
    if _supabase_enabled():
        from db.datasource import fetch_rera_projects

        return fetch_rera_projects()
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("projects", [])


def load_osm_amenities(path: Path = OSM_PATH) -> list[dict[str, Any]]:
    if _supabase_enabled():
        from db.datasource import fetch_osm_amenities

        return fetch_osm_amenities()
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("amenities", [])


def extract_localities_from_osm(path: Path = OSM_PATH) -> list[str]:
    """Unique locality names from OSM amenity address tags (deduped by normalized form).

    Always reads the local JSON extract so batch scoring works before Supabase
    is populated.
    """
    amenities = json.loads(path.read_text(encoding="utf-8")).get("amenities", [])
    counts: Counter[str] = Counter()
    for record in amenities:
        tags = record.get("tags") or {}
        for key in OSM_LOCALITY_TAG_KEYS:
            value = tags.get(key)
            if not value or not isinstance(value, str):
                continue
            name = re.sub(r"\s+", " ", value.strip())
            if len(name) <= 2 or len(name) >= 80 or name.isdigit():
                continue
            counts[name] += 1

    by_normalized: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for name, count in counts.items():
        by_normalized[normalize_locality(name)].append((name, count))

    canonical: list[str] = []
    for variants in by_normalized.values():
        best_name = max(variants, key=lambda item: item[1])[0]
        canonical.append(best_name)

    return sorted(canonical, key=str.casefold)


def score_result_to_dict(result: ScoreResult) -> dict[str, Any]:
    return {
        "locality": result.locality,
        "neighbourhood_score": result.neighbourhood_score,
        "rera_score": result.rera_score,
        "amenity_score": result.amenity_score,
        "rera_projects_matched": result.rera_projects_matched,
        "avg_complaints": result.avg_complaints,
        "amenity_counts": {
            "hospital": result.amenity_counts.hospital,
            "school": result.amenity_counts.school,
            "park": result.amenity_counts.park,
            "metro": result.amenity_counts.metro,
        },
        "centre": {"lat": result.centre_lat, "lon": result.centre_lon},
        "details": result.details,
    }


def batch_score_osm_localities(
    output_path: Path = SCORES_PATH,
    osm_path: Path = OSM_PATH,
    use_overpass: bool = True,
    geocode_delay_sec: float = NOMINATIM_DELAY_SEC,
) -> dict[str, Any]:
    """Score every locality name found in osm_bangalore.json and write scores_bangalore.json."""
    locality_names = extract_localities_from_osm(osm_path)
    scores: list[dict[str, Any]] = []
    errors = 0

    print(f"Scoring {len(locality_names)} localities from {osm_path.name}…")

    for index, name in enumerate(locality_names, start=1):
        print(f"[{index}/{len(locality_names)}] {name}", flush=True)
        try:
            result = score_locality(name, osm_path=osm_path, use_overpass=use_overpass)
            scores.append(score_result_to_dict(result))
        except Exception as exc:
            errors += 1
            scores.append({"locality": name, "error": str(exc)})
            print(f"  ✗ {exc}", flush=True)

        if geocode_delay_sec > 0 and index < len(locality_names):
            time.sleep(geocode_delay_sec)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_osm": str(osm_path.relative_to(ROOT)) if osm_path.is_relative_to(ROOT) else str(osm_path),
        "localities_scored": len([s for s in scores if "error" not in s]),
        "localities_failed": errors,
        "localities_total": len(locality_names),
        "scores": scores,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"\nWrote {output_path} ({payload['localities_scored']} ok, {errors} failed)")
    return payload


def match_rera_projects(projects: list[dict[str, Any]], locality: str) -> list[dict[str, Any]]:
    """Match RERA projects by substring or fuzzy locality (fuzzywuzzy)."""
    matched: list[dict[str, Any]] = []

    for project in projects:
        haystack = _rera_haystack(project)
        if not haystack:
            continue
        if fuzzy_locality_matches(locality, haystack):
            matched.append(project)

    return matched


def compute_rera_score(projects: list[dict[str, Any]]) -> tuple[float, float | None]:
    """
    Lower average complaints -> higher score (0-100).
    0 avg complaints = 100; each complaint costs 12 points (capped at 0).
    """
    if not projects:
        return 75.0, None

    avg_complaints = sum(p.get("complaints_count") or 0 for p in projects) / len(projects)
    score = max(0.0, min(100.0, 100.0 - avg_complaints * 12.0))
    return score, avg_complaints


def classify_amenity(record: dict[str, Any]) -> str | None:
    amenity = (record.get("amenity") or "").lower()
    tags = record.get("tags") or {}
    name = (record.get("name") or "").lower()

    if amenity in HOSPITAL_TYPES:
        return "hospital"
    if amenity in SCHOOL_TYPES:
        return "school"
    if tags.get("leisure") == "park" or (
        "park" in name and not amenity.startswith("parking") and amenity != "parking"
    ):
        return "park"
    if tags.get("railway") == "station" or tags.get("station") == "subway":
        return "metro"
    if amenity == "bus_station" and "metro" in name:
        return "metro"
    return None


def count_local_amenities(
    amenities: list[dict[str, Any]],
    lat: float,
    lon: float,
    radius_km: float = RADIUS_KM,
) -> AmenityCounts:
    counts = AmenityCounts()
    for record in amenities:
        rlat, rlon = record.get("lat"), record.get("lon")
        if rlat is None or rlon is None:
            continue
        if haversine_km(lat, lon, rlat, rlon) > radius_km:
            continue
        category = classify_amenity(record)
        if category == "hospital":
            counts.hospital += 1
        elif category == "school":
            counts.school += 1
        elif category == "park":
            counts.park += 1
        elif category == "metro":
            counts.metro += 1
    return counts


def fetch_overpass_parks_metro(lat: float, lon: float, radius_m: int = 3000) -> AmenityCounts:
    """Supplement local JSON with park/metro nodes from Overpass (not in amenity=* extract)."""
    query = f"""
    [out:json][timeout:30];
    (
      node["leisure"="park"](around:{radius_m},{lat},{lon});
      way["leisure"="park"](around:{radius_m},{lat},{lon});
      node["railway"="station"]["station"~"subway|light_rail|metro"](around:{radius_m},{lat},{lon});
      node["public_transport"="station"]["subway"="yes"](around:{radius_m},{lat},{lon});
    );
    out center;
    """
    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": "RealEstateNeighbourhoodScorer/1.0"},
            timeout=45,
        )
        response.raise_for_status()
        elements = response.json().get("elements", [])
    except requests.RequestException:
        return AmenityCounts()

    counts = AmenityCounts()
    for element in elements:
        tags = element.get("tags") or {}
        if tags.get("leisure") == "park":
            counts.park += 1
        elif tags.get("railway") == "station" or tags.get("subway") == "yes":
            counts.metro += 1
    return counts


def get_nearby_amenities(
    lat: float,
    lon: float,
    radius_km: float = RADIUS_KM,
    limit_per_category: int = 250,
) -> list[dict[str, Any]]:
    """Return classified amenity points within radius for map display."""
    amenities = load_osm_amenities()
    counts: dict[str, int] = {"hospital": 0, "school": 0, "park": 0, "metro": 0}
    points: list[dict[str, Any]] = []

    for record in amenities:
        rlat, rlon = record.get("lat"), record.get("lon")
        if rlat is None or rlon is None:
            continue
        if haversine_km(lat, lon, rlat, rlon) > radius_km:
            continue
        category = classify_amenity(record)
        if not category or counts[category] >= limit_per_category:
            continue
        counts[category] += 1
        points.append(
            {
                "lat": rlat,
                "lon": rlon,
                "name": record.get("name") or category.title(),
                "category": category,
            }
        )

    return points


def _element_lat_lon(element: dict[str, Any]) -> tuple[float, float] | None:
    if "lat" in element and "lon" in element:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center")
    if center and "lat" in center and "lon" in center:
        return float(center["lat"]), float(center["lon"])
    return None


def _category_from_overpass_tags(tags: dict[str, Any]) -> str | None:
    amenity = (tags.get("amenity") or "").lower()
    if amenity in HOSPITAL_TYPES:
        return "hospital"
    if amenity in SCHOOL_TYPES:
        return "school"
    if tags.get("leisure") == "park":
        return "park"
    if tags.get("railway") == "station" or tags.get("subway") == "yes":
        return "metro"
    return None


def fetch_overpass_amenity_points(
    lat: float, lon: float, radius_m: int = 3000, limit: int = 400
) -> list[dict[str, Any]]:
    """Hospitals, schools, parks, metro from Overpass (fallback / supplement for map)."""
    query = f"""
    [out:json][timeout:45];
    (
      node["amenity"~"hospital|clinic|doctors"](around:{radius_m},{lat},{lon});
      node["amenity"~"school|college|university|kindergarten"](around:{radius_m},{lat},{lon});
      node["leisure"="park"](around:{radius_m},{lat},{lon});
      way["leisure"="park"](around:{radius_m},{lat},{lon});
      node["railway"="station"]["station"~"subway|light_rail|metro"](around:{radius_m},{lat},{lon});
      node["public_transport"="station"]["subway"="yes"](around:{radius_m},{lat},{lon});
    );
    out center;
    """
    points: list[dict[str, Any]] = []
    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": "RealEstateNeighbourhoodScorer/1.0"},
            timeout=60,
        )
        response.raise_for_status()
        for element in response.json().get("elements", []):
            if len(points) >= limit:
                break
            tags = element.get("tags") or {}
            coords = _element_lat_lon(element)
            if not coords:
                continue
            elat, elon = coords
            category = _category_from_overpass_tags(tags)
            if not category:
                continue
            points.append(
                {
                    "lat": elat,
                    "lon": elon,
                    "name": tags.get("name") or category.title(),
                    "category": category,
                }
            )
    except requests.RequestException:
        pass
    return points


def build_map_amenities(
    lat: float,
    lon: float,
    radius_km: float = RADIUS_KM,
    limit_per_category: int = 120,
) -> list[dict[str, Any]]:
    """All map pin points: local OSM JSON + Overpass supplement."""
    points = get_nearby_amenities(lat, lon, radius_km=radius_km, limit_per_category=limit_per_category)
    existing = {(p["lat"], p["lon"], p["category"]) for p in points}
    radius_m = int(radius_km * 1000)
    for point in fetch_overpass_amenity_points(lat, lon, radius_m=radius_m):
        key = (point["lat"], point["lon"], point["category"])
        if key not in existing:
            points.append(point)
            existing.add(key)
    return points


def compute_amenity_score(counts: AmenityCounts) -> float:
    """
    Weighted amenity score (0-100).
    Weights: metro=4, hospital=3, school=2, park=2.
    Saturates around ~15 weighted points -> 100.
    """
    weighted = (
        counts.metro * 4
        + counts.hospital * 3
        + counts.school * 2
        + counts.park * 2
    )
    return max(0.0, min(100.0, weighted * (100.0 / 15.0)))


def score_locality(
    locality: str,
    rera_path: Path = RERA_PATH,
    osm_path: Path = OSM_PATH,
    use_overpass: bool = True,
) -> ScoreResult:
    lat, lon, display_name = geocode_locality(locality)

    rera_projects = load_rera_projects(rera_path)
    matched = match_rera_projects(rera_projects, locality)
    rera_score, avg_complaints = compute_rera_score(matched)

    osm_amenities = load_osm_amenities(osm_path)
    counts = count_local_amenities(osm_amenities, lat, lon)

    if use_overpass:
        overpass_counts = fetch_overpass_parks_metro(lat, lon)
        counts.park += overpass_counts.park
        counts.metro += overpass_counts.metro

    amenity_score = compute_amenity_score(counts)
    neighbourhood_score = round(0.45 * rera_score + 0.55 * amenity_score, 1)

    return ScoreResult(
        locality=locality,
        centre_lat=lat,
        centre_lon=lon,
        rera_score=round(rera_score, 1),
        amenity_score=round(amenity_score, 1),
        neighbourhood_score=neighbourhood_score,
        rera_projects_matched=len(matched),
        avg_complaints=round(avg_complaints, 2) if avg_complaints is not None else None,
        amenity_counts=counts,
        details={
            "geocoded_as": display_name,
            "radius_km": RADIUS_KM,
            "rera_weight": 0.45,
            "amenity_weight": 0.55,
        },
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute Neighbourhood Score for a Bangalore locality")
    parser.add_argument(
        "locality",
        nargs="?",
        help='Locality name, e.g. "Indiranagar" (omit with --batch-osm)',
    )
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--no-overpass", action="store_true", help="Skip Overpass park/metro supplement")
    parser.add_argument(
        "--batch-osm",
        action="store_true",
        help="Score all localities from data/raw/osm_bangalore.json → data/scores_bangalore.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=SCORES_PATH,
        help="Output path for --batch-osm",
    )
    args = parser.parse_args()

    if args.batch_osm:
        batch_score_osm_localities(
            output_path=args.output,
            use_overpass=not args.no_overpass,
        )
        return

    if not args.locality:
        parser.error("locality is required unless --batch-osm is set")

    result = score_locality(args.locality, use_overpass=not args.no_overpass)

    if args.json:
        print(json.dumps(score_result_to_dict(result), indent=2))
    else:
        print(f"Locality: {result.locality}")
        print(f"Neighbourhood Score: {result.neighbourhood_score}/100")
        print(f"  RERA score:    {result.rera_score}/100  ({result.rera_projects_matched} projects, avg complaints: {result.avg_complaints})")
        print(f"  Amenity score: {result.amenity_score}/100")
        c = result.amenity_counts
        print(f"    Within {RADIUS_KM}km: hospital={c.hospital}, school={c.school}, park={c.park}, metro={c.metro}")
        print(f"  Centre: {result.centre_lat:.5f}, {result.centre_lon:.5f}")
        print(f"  Geocoded: {result.details.get('geocoded_as')}")


if __name__ == "__main__":
    main()
