/**
 * Neighbourhood Score (0-100) from RERA project complaints and nearby OSM amenities.
 * Port of pipeline/scorer.py.
 */

import { ratio } from "./fuzzy";
import {
  loadOsmAmenities,
  loadReraProjects,
  type OsmAmenity,
  type PrescoredLocality,
  type ReraProject,
} from "./data";

export const RADIUS_KM = 3.0;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const HOSPITAL_TYPES = new Set(["hospital", "clinic", "doctors"]);
const SCHOOL_TYPES = new Set([
  "school",
  "college",
  "university",
  "kindergarten",
]);
const FUZZY_LOCALITY_THRESHOLD = 85;

/**
 * Weighted amenity points that earn a full 100. Calibrated against the
 * pre-scored Bangalore localities (p90 = 1332, max = 1598) so scores spread
 * across the range instead of saturating after ~5 hospitals.
 */
export const AMENITY_FULL_SCORE_POINTS = 1500;

/** Greater-Bengaluru bounding box; geocode hits outside it are rejected. */
const BLR_BOUNDS = { latMin: 12.65, latMax: 13.3, lonMin: 77.3, lonMax: 77.9 };

const USER_AGENT = "RealEstateNeighbourhoodScorer/1.0";

export type Category = "hospital" | "school" | "park" | "metro";

export interface AmenityCounts {
  hospital: number;
  school: number;
  park: number;
  metro: number;
}

export interface MapAmenity {
  lat: number;
  lon: number;
  name: string;
  category: Category;
}

export interface ScoreResult {
  locality: string;
  centre_lat: number;
  centre_lon: number;
  /** null when no RERA projects matched (no data; never invented). */
  rera_score: number | null;
  rera_data_available: boolean;
  amenity_score: number;
  neighbourhood_score: number;
  rera_projects_matched: number;
  avg_complaints: number | null;
  amenity_counts: AmenityCounts;
  details: Record<string, unknown>;
}

export class GeocodeError extends Error {
  constructor(locality: string) {
    super(`Could not geocode locality: ${locality}`);
    this.name = "GeocodeError";
  }
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371.0;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dlat = ((lat2 - lat1) * Math.PI) / 180;
  const dlon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dlon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function normalizeLocality(name: string): string {
  return name.replace(/\s+/g, " ").trim().toUpperCase();
}

function reraHaystack(p: ReraProject): string {
  return normalizeLocality(`${p.locality ?? ""} ${p.project_name ?? ""}`);
}

function localitySegments(text: string): string[] {
  const normalized = normalizeLocality(text);
  if (!normalized) return [];
  const segments = new Set<string>([normalized]);
  for (const raw of normalized.split(/\s*[-–—/|,]\s*/)) {
    const part = raw.trim();
    if (part.length > 2) segments.add(part);
  }
  return [...segments];
}

/**
 * Words that appear in thousands of Bangalore place and project names. They
 * say nothing about WHICH locality, so they are ignored when matching
 * ("HSR Layout" must not match every "... Layout").
 */
const GENERIC_WORDS = new Set([
  "LAYOUT", "NAGAR", "ROAD", "EXTENSION", "EXTN", "PHASE", "STAGE", "BLOCK",
  "CROSS", "MAIN", "SECTOR", "TOWN", "COLONY", "CITY", "ENCLAVE", "GARDEN",
  "GARDENS", "APARTMENTS", "APARTMENT", "RESIDENCY", "PROJECT", "INDUSTRIAL",
  "AREA", "ESTATE", "THE", "AND", "OF", "BY",
]);

/** The distinctive part of a name: generic words removed. "" if nothing is left. */
function coreOf(text: string): string {
  return text
    .split(/[^A-Z0-9]+/)
    .filter((t) => t && !GENERIC_WORDS.has(t))
    .join(" ");
}

/** True when `needle` appears in `hay` as whole word(s), not inside another word. */
function containsWords(hay: string, needle: string): boolean {
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Z0-9])${escaped}($|[^A-Z0-9])`).test(hay);
}

function fuzzyLocalityMatches(
  query: string,
  haystack: string,
  threshold = FUZZY_LOCALITY_THRESHOLD,
): boolean {
  const q = normalizeLocality(query);
  const h = normalizeLocality(haystack);
  if (!q || !h) return false;

  // Compare the distinctive part of the query (fall back to all of it when the
  // query is made only of generic words).
  const qc = coreOf(q) || q;

  // The query's distinctive words appear as whole words in the record.
  if (containsWords(h, qc)) return true;

  for (const text of [h, ...localitySegments(h)]) {
    const tc = coreOf(text);
    if (!tc) continue;
    // A short stored name (e.g. "NA", "IRA") sitting inside a longer query is
    // coincidence, not a match: it must be a whole word and reasonably long.
    if (tc.length >= 4 && containsWords(qc, tc)) return true;
    if (wordWindowMatches(qc, tc, threshold)) return true;
  }
  return false;
}

/**
 * Typo-tolerant match at WORD level: some run of 1-2 words of `text` must be
 * (almost) the query. Comparing whole words stops "AGARA" matching inside
 * "NAGARA"; requiring the same first letter stops "JAYANAGAR" matching
 * "VIJAYANAGARA"; very short names must match exactly.
 */
function wordWindowMatches(qc: string, text: string, threshold: number): boolean {
  const qWords = qc.split(" ").length;
  const tWords = text.split(" ");
  for (let k = Math.max(1, qWords - 1); k <= qWords + 1; k++) {
    for (let i = 0; i + k <= tWords.length; i++) {
      const w = tWords.slice(i, i + k).join(" ");
      if (w === qc) return true;
      if (qc.length <= 5 || w[0] !== qc[0]) continue;
      if (ratio(qc, w) >= threshold) return true;
    }
  }
  return false;
}

function inBengaluru(lat: number, lon: number): boolean {
  return (
    lat >= BLR_BOUNDS.latMin &&
    lat <= BLR_BOUNDS.latMax &&
    lon >= BLR_BOUNDS.lonMin &&
    lon <= BLR_BOUNDS.lonMax
  );
}

/** Simplified spellings to retry when the exact name is not found. */
function localityVariants(locality: string): string[] {
  const out: string[] = [locality.trim()];
  const add = (v: string) => {
    const t = v.replace(/\s+/g, " ").trim();
    if (t.length > 2 && !out.includes(t)) out.push(t);
  };
  // "BommanaHalli Cmc" -> "BommanaHalli"; "Begur Hobli" -> "Begur"
  add(locality.replace(/\b(cmc|hobli|tmc|town municipal council)\b/gi, ""));
  // "JP Nagar 5th Phase" -> "JP Nagar"
  add(
    locality.replace(/\b\d+(st|nd|rd|th)?\s*(phase|block|stage|sector|main|cross)\b/gi, ""),
  );
  // "4th Block, 5th Block Jayanagar" -> each comma part with block numbers stripped
  for (const part of locality.split(",")) {
    add(part.replace(/\b\d+(st|nd|rd|th)?\s*(phase|block|stage|sector|main|cross)\b/gi, ""));
  }
  return out.slice(0, 4);
}

export async function geocodeLocality(
  locality: string,
): Promise<{ lat: number; lon: number; display_name: string }> {
  const queries: string[] = [];
  for (const v of localityVariants(locality)) {
    queries.push(`${v}, Bengaluru, Karnataka, India`);
  }
  queries.push(`${locality}, Bangalore, Karnataka, India`);

  for (const q of queries) {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) continue;
    const results = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name?: string;
    }>;
    // Take the first hit that is actually inside Greater Bengaluru.
    for (const r of results) {
      const lat = parseFloat(r.lat);
      const lon = parseFloat(r.lon);
      if (inBengaluru(lat, lon)) {
        return { lat, lon, display_name: r.display_name ?? q };
      }
    }
  }

  throw new GeocodeError(locality);
}

export function matchReraProjects(
  projects: ReraProject[],
  locality: string,
): ReraProject[] {
  const matched: ReraProject[] = [];
  for (const p of projects) {
    const hay = reraHaystack(p);
    if (!hay) continue;
    if (fuzzyLocalityMatches(locality, hay)) matched.push(p);
  }
  return matched;
}

export function computeReraScore(projects: ReraProject[]): {
  score: number | null;
  avg_complaints: number | null;
} {
  // No matching projects = no evidence either way. Do not invent a score.
  if (projects.length === 0) return { score: null, avg_complaints: null };
  const avg =
    projects.reduce((sum, p) => sum + (p.complaints_count ?? 0), 0) /
    projects.length;
  const score = Math.max(0, Math.min(100, 100 - avg * 12));
  return { score, avg_complaints: avg };
}

function classifyAmenity(record: OsmAmenity): Category | null {
  const amenity = (record.amenity ?? "").toLowerCase();
  const tags = record.tags ?? {};
  const name = (record.name ?? "").toLowerCase();

  if (HOSPITAL_TYPES.has(amenity)) return "hospital";
  if (SCHOOL_TYPES.has(amenity)) return "school";
  if (
    tags.leisure === "park" ||
    (name.includes("park") &&
      !amenity.startsWith("parking") &&
      amenity !== "parking")
  ) {
    return "park";
  }
  if (tags.railway === "station" || tags.station === "subway") return "metro";
  if (amenity === "bus_station" && name.includes("metro")) return "metro";
  return null;
}

function countLocalAmenities(
  amenities: OsmAmenity[],
  lat: number,
  lon: number,
  radiusKm = RADIUS_KM,
): AmenityCounts {
  const counts: AmenityCounts = { hospital: 0, school: 0, park: 0, metro: 0 };
  for (const r of amenities) {
    const rlat = r.lat;
    const rlon = r.lon;
    if (rlat == null || rlon == null) continue;
    if (haversineKm(lat, lon, rlat, rlon) > radiusKm) continue;
    const cat = classifyAmenity(r);
    if (cat) counts[cat] += 1;
  }
  return counts;
}

async function fetchOverpassParksMetro(
  lat: number,
  lon: number,
  radiusM = 3000,
): Promise<{ park: number; metro: number }> {
  const query = `
    [out:json][timeout:30];
    (
      node["leisure"="park"](around:${radiusM},${lat},${lon});
      way["leisure"="park"](around:${radiusM},${lat},${lon});
      node["railway"="station"]["station"~"subway|light_rail|metro"](around:${radiusM},${lat},${lon});
      node["public_transport"="station"]["subway"="yes"](around:${radiusM},${lat},${lon});
    );
    out center;
  `;
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { park: 0, metro: 0 };
    const data = (await res.json()) as {
      elements?: Array<{ tags?: Record<string, string> }>;
    };
    let park = 0;
    let metro = 0;
    for (const el of data.elements ?? []) {
      const tags = el.tags ?? {};
      if (tags.leisure === "park") park += 1;
      else if (tags.railway === "station" || tags.subway === "yes") metro += 1;
    }
    return { park, metro };
  } catch {
    return { park: 0, metro: 0 };
  }
}

function elementLatLon(
  el: { lat?: number; lon?: number; center?: { lat: number; lon: number } },
): [number, number] | null {
  if (el.lat != null && el.lon != null) return [el.lat, el.lon];
  if (el.center) return [el.center.lat, el.center.lon];
  return null;
}

function categoryFromOverpassTags(
  tags: Record<string, string>,
): Category | null {
  const amenity = (tags.amenity ?? "").toLowerCase();
  if (HOSPITAL_TYPES.has(amenity)) return "hospital";
  if (SCHOOL_TYPES.has(amenity)) return "school";
  if (tags.leisure === "park") return "park";
  if (tags.railway === "station" || tags.subway === "yes") return "metro";
  return null;
}

async function fetchOverpassAmenityPoints(
  lat: number,
  lon: number,
  radiusM = 3000,
  limit = 400,
): Promise<MapAmenity[]> {
  const query = `
    [out:json][timeout:45];
    (
      node["amenity"~"hospital|clinic|doctors"](around:${radiusM},${lat},${lon});
      node["amenity"~"school|college|university|kindergarten"](around:${radiusM},${lat},${lon});
      node["leisure"="park"](around:${radiusM},${lat},${lon});
      way["leisure"="park"](around:${radiusM},${lat},${lon});
      node["railway"="station"]["station"~"subway|light_rail|metro"](around:${radiusM},${lat},${lon});
      node["public_transport"="station"]["subway"="yes"](around:${radiusM},${lat},${lon});
    );
    out center;
  `;
  const points: MapAmenity[] = [];
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return points;
    const data = (await res.json()) as {
      elements?: Array<{
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }>;
    };
    for (const el of data.elements ?? []) {
      if (points.length >= limit) break;
      const coords = elementLatLon(el);
      const tags = el.tags ?? {};
      if (!coords) continue;
      const cat = categoryFromOverpassTags(tags);
      if (!cat) continue;
      points.push({
        lat: coords[0],
        lon: coords[1],
        name:
          tags.name ?? cat.charAt(0).toUpperCase() + cat.slice(1),
        category: cat,
      });
    }
  } catch {
    /* ignore */
  }
  return points;
}

export async function getNearbyAmenities(
  lat: number,
  lon: number,
  radiusKm = RADIUS_KM,
  limitPerCategory = 250,
): Promise<MapAmenity[]> {
  const amenities = await loadOsmAmenities();
  const counts: Record<Category, number> = {
    hospital: 0,
    school: 0,
    park: 0,
    metro: 0,
  };
  const points: MapAmenity[] = [];

  for (const r of amenities) {
    const rlat = r.lat;
    const rlon = r.lon;
    if (rlat == null || rlon == null) continue;
    if (haversineKm(lat, lon, rlat, rlon) > radiusKm) continue;
    const cat = classifyAmenity(r);
    if (!cat || counts[cat] >= limitPerCategory) continue;
    counts[cat] += 1;
    points.push({
      lat: rlat,
      lon: rlon,
      name: r.name ?? cat.charAt(0).toUpperCase() + cat.slice(1),
      category: cat,
    });
  }
  return points;
}

export async function buildMapAmenities(
  lat: number,
  lon: number,
  radiusKm = RADIUS_KM,
  limitPerCategory = 120,
  options: { useOverpass?: boolean } = {},
): Promise<MapAmenity[]> {
  const useOverpass = options.useOverpass ?? false;
  const points = await getNearbyAmenities(lat, lon, radiusKm, limitPerCategory);
  if (!useOverpass) return points;

  const existing = new Set(
    points.map((p) => `${p.lat}|${p.lon}|${p.category}`),
  );
  const radiusM = Math.round(radiusKm * 1000);
  const supplemental = await fetchOverpassAmenityPoints(lat, lon, radiusM);
  for (const p of supplemental) {
    const key = `${p.lat}|${p.lon}|${p.category}`;
    if (!existing.has(key)) {
      points.push(p);
      existing.add(key);
    }
  }
  return points;
}

function computeAmenityScore(counts: AmenityCounts): number {
  const weighted =
    counts.metro * 4 + counts.hospital * 3 + counts.school * 2 + counts.park * 2;
  return Math.max(
    0,
    Math.min(100, weighted * (100 / AMENITY_FULL_SCORE_POINTS)),
  );
}

export async function scoreLocality(
  locality: string,
  options: { useOverpass?: boolean } = {},
): Promise<ScoreResult> {
  // Overpass is opt-in — default off so Vercel /api/report stays under gateway limits.
  const useOverpass = options.useOverpass ?? false;
  const { lat, lon, display_name } = await geocodeLocality(locality);

  const [reraProjects, osm] = await Promise.all([
    loadReraProjects(),
    loadOsmAmenities(),
  ]);
  const matched = matchReraProjects(reraProjects, locality);
  const { score: reraScore, avg_complaints } = computeReraScore(matched);

  const counts = countLocalAmenities(osm, lat, lon);

  if (useOverpass) {
    const overpass = await fetchOverpassParksMetro(lat, lon);
    counts.park += overpass.park;
    counts.metro += overpass.metro;
  }

  const amenityScore = computeAmenityScore(counts);
  const reraAvailable = reraScore !== null;
  // Without RERA data the score is the amenity score alone (weights 0 / 1).
  const neighbourhoodScore = reraAvailable
    ? round1(0.45 * reraScore + 0.55 * amenityScore)
    : round1(amenityScore);

  return {
    locality,
    centre_lat: lat,
    centre_lon: lon,
    rera_score: reraScore === null ? null : round1(reraScore),
    rera_data_available: reraAvailable,
    amenity_score: round1(amenityScore),
    neighbourhood_score: neighbourhoodScore,
    rera_projects_matched: matched.length,
    avg_complaints: avg_complaints == null ? null : round2(avg_complaints),
    amenity_counts: counts,
    details: {
      geocoded_as: display_name,
      radius_km: RADIUS_KM,
      rera_weight: reraAvailable ? 0.45 : 0,
      amenity_weight: reraAvailable ? 0.55 : 1,
      amenity_full_score_points: AMENITY_FULL_SCORE_POINTS,
    },
  };
}

/** Build a ScoreResult from the precomputed scores JSON (skips geocode + OSM scan). */
export function scoreResultFromPrescored(
  entry: PrescoredLocality,
  requestedLocality: string,
): ScoreResult | null {
  if (!entry.centre) return null;
  const counts = entry.amenity_counts ?? {
    hospital: 0,
    school: 0,
    park: 0,
    metro: 0,
  };
  return {
    locality: requestedLocality,
    centre_lat: entry.centre.lat,
    centre_lon: entry.centre.lon,
    rera_score: entry.rera_score,
    amenity_score: entry.amenity_score,
    neighbourhood_score: entry.neighbourhood_score,
    rera_projects_matched: entry.rera_projects_matched ?? 0,
    avg_complaints: entry.avg_complaints ?? null,
    amenity_counts: counts,
    details: {
      ...(entry.details ?? {}),
      source: "prescored",
      matched_prescored_locality: entry.locality,
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function scoreResultToDict(r: ScoreResult): Record<string, unknown> {
  return {
    locality: r.locality,
    neighbourhood_score: r.neighbourhood_score,
    rera_score: r.rera_score,
    rera_data_available: r.rera_data_available,
    amenity_score: r.amenity_score,
    amenity_breakdown: {
      hospital: r.amenity_counts.hospital,
      school: r.amenity_counts.school,
      park: r.amenity_counts.park,
      metro: r.amenity_counts.metro,
    },
    rera_projects_matched: r.rera_projects_matched,
    avg_complaints: r.avg_complaints,
    centre: { lat: r.centre_lat, lon: r.centre_lon },
  };
}
