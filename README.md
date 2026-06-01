# Hyper-Local Real Estate — Bangalore Neighbourhood Intelligence

Score any Bangalore locality on a **0–100 Neighbourhood Score** built from RERA
project complaint data and nearby OpenStreetMap amenities (hospitals, schools,
parks, metro), then generate an AI investment report and an interactive map.

- **Backend** — Python scrapers + scoring pipeline + FastAPI
- **Data layer** — Supabase (with local-JSON fallback)
- **AI reports** — Groq
- **Frontend** — Next.js + MapLibre + Vanta animated hero

---

## Architecture

```
OSM (Overpass)  ─┐
                 ├─► scrapers/ ─► data/raw/*.json ─► pipeline/scorer.py ─┐
RERA Karnataka  ─┘                                                       │
                                                                         ▼
                          Supabase  ◄── scripts/upload_to_supabase.py   scores
                          (localities, rera_projects, osm_amenities)      │
                                 │                                         ▼
                                 └────────────► api/main.py (FastAPI) ─► frontend/ (Next.js)
                                                        │
                                                        └─► Groq (AI report)
```

The API reads from **Supabase** when `SUPABASE_URL` / `SUPABASE_KEY` are set,
and transparently falls back to the local JSON files otherwise.

---

## Scoring model

| Component | Source | Logic |
|-----------|--------|-------|
| RERA score | RERA Karnataka complaints | Fewer average complaints → higher score (0 complaints = 100; −12 pts each) |
| Amenity score | OSM amenities within 3 km | Weighted: metro ×4, hospital ×3, school ×2, park ×2, saturating at 100 |
| **Neighbourhood score** | — | `0.45 × RERA + 0.55 × amenity` |

Locality names are matched to RERA records with fuzzy matching (`fuzzywuzzy`),
and coordinates are resolved via Nominatim. Parks/metro are supplemented live
from Overpass.

---

## Project structure

```
.
├── api/main.py                  # FastAPI app (/health /localities /score /report /amenities)
├── pipeline/
│   ├── scorer.py                # Scoring + geocoding + matching (Supabase or JSON)
│   └── report_generator.py      # Groq AI report
├── scrapers/                    # OSM + RERA collectors
├── db/
│   ├── supabase_client.py       # Lazy Supabase client from env
│   ├── datasource.py            # Paginated, cached reads
│   └── schema.sql               # Supabase table definitions
├── scripts/upload_to_supabase.py # Migrate local JSON → Supabase
├── data/                        # Raw + scored JSON datasets
├── frontend/                    # Next.js app
└── requirements.txt
```

---

## Setup

### 1. Backend

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Create a root `.env`:

```bash
GROQ_API_KEY=your_groq_key
# Optional — enables Supabase instead of local JSON:
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_KEY=your_service_role_key
```

Run the API:

```bash
uvicorn api.main:app --reload --port 8000
```

### 2. Supabase (optional)

1. Run `db/schema.sql` in the Supabase SQL editor.
2. Set `SUPABASE_URL` and `SUPABASE_KEY` in `.env`.
3. Upload the datasets:

```bash
python scripts/upload_to_supabase.py            # all tables
python scripts/upload_to_supabase.py --only osm  # one table
python scripts/upload_to_supabase.py --truncate  # replace existing rows
```

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Run it:

```bash
npm run dev   # http://localhost:3000
```

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/localities` | All pre-scored localities |
| GET | `/score?locality=Indiranagar` | Score a single locality |
| GET | `/report?locality=Indiranagar` | Score + AI report + map amenities |
| GET | `/amenities?lat=..&lon=..&radius_km=3` | Nearby amenity points |

Example:

```bash
curl "http://localhost:8000/report?locality=Indiranagar"
```

---

## Regenerating scores

```bash
python pipeline/scorer.py "Indiranagar"        # single locality
python pipeline/scorer.py --batch-osm          # score all OSM localities → data/scores_bangalore.json
```

---

## Tech stack

**Backend:** Python, FastAPI, Uvicorn, Supabase, Groq, fuzzywuzzy, BeautifulSoup, requests
**Frontend:** Next.js, React, MapLibre GL, Vanta.js, Framer Motion, Tailwind CSS
**Data:** OpenStreetMap (Overpass), RERA Karnataka, Nominatim

---

## Notes

- `data/` ships with pre-scraped OSM (~27k amenities) and RERA (~9.6k projects) datasets.
- Secrets (`.env`, `frontend/.env.local`) are git-ignored — never commit your keys.
