"""FastAPI backend for neighbourhood scoring and AI reports."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

from db.supabase_client import supabase_enabled
from pipeline.report_generator import generate_report
from pipeline.scorer import ScoreResult, build_map_amenities, score_locality

SCORES_PATH = ROOT / "data" / "scores_bangalore.json"

app = FastAPI(title="Bangalore Neighbourhood API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def score_result_to_dict(result: ScoreResult) -> dict[str, Any]:
    return {
        "locality": result.locality,
        "neighbourhood_score": result.neighbourhood_score,
        "rera_score": result.rera_score,
        "amenity_score": result.amenity_score,
        "amenity_breakdown": {
            "hospital": result.amenity_counts.hospital,
            "school": result.amenity_counts.school,
            "park": result.amenity_counts.park,
            "metro": result.amenity_counts.metro,
        },
        "rera_projects_matched": result.rera_projects_matched,
        "avg_complaints": result.avg_complaints,
        "centre": {"lat": result.centre_lat, "lon": result.centre_lon},
    }


def get_groq_api_key() -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY not configured. Add it to .env in the project root.",
        )
    return api_key


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/localities")
def localities() -> dict[str, Any]:
    if supabase_enabled():
        from db.datasource import fetch_scores

        try:
            items = fetch_scores()
        except Exception as exc:
            raise HTTPException(
                status_code=502, detail=f"Supabase query failed: {exc}"
            ) from exc
        return {"count": len(items), "localities": items}

    if not SCORES_PATH.exists():
        raise HTTPException(status_code=404, detail="Pre-scored localities file not found")

    data = json.loads(SCORES_PATH.read_text(encoding="utf-8"))
    items = []
    for entry in data.get("scores", []):
        if "error" in entry:
            continue
        items.append(
            {
                "locality": entry["locality"],
                "neighbourhood_score": entry["neighbourhood_score"],
                "rera_score": entry["rera_score"],
                "amenity_score": entry["amenity_score"],
            }
        )
    return {"count": len(items), "localities": items}


@app.get("/amenities")
def amenities(
    lat: float = Query(..., description="Centre latitude"),
    lon: float = Query(..., description="Centre longitude"),
    radius_km: float = Query(3.0, ge=0.5, le=10.0),
) -> dict[str, Any]:
    try:
        points = build_map_amenities(lat, lon, radius_km=radius_km)
        return {"count": len(points), "amenities": points}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Amenities fetch failed: {exc}") from exc


@app.get("/score")
def score(locality: str = Query(..., description="Bangalore locality name")) -> dict[str, Any]:
    try:
        result = score_locality(locality)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Scoring failed: {exc}") from exc
    return score_result_to_dict(result)


@app.get("/report")
def report(locality: str = Query(..., description="Bangalore locality name")) -> dict[str, Any]:
    try:
        result = score_locality(locality)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Scoring failed: {exc}") from exc

    score_data = score_result_to_dict(result)
    try:
        ai_report = generate_report(score_data, get_groq_api_key())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Report generation failed: {exc}") from exc

    try:
        map_amenities = build_map_amenities(
            result.centre_lat,
            result.centre_lon,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"Amenities fetch failed: {exc}"
        ) from exc

    return {**score_data, "ai_report": ai_report, "amenities": map_amenities}
