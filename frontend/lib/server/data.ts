/**
 * Server-side data loaders. Supabase when configured, otherwise local JSON.
 *
 * Caches loaded JSON / Supabase fetches in module scope so each serverless
 * function instance pays the parse cost once.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { supabaseEnabled, supabaseClient } from "./supabase";

export interface ReraProject {
  ack_number?: string | null;
  rera_number?: string | null;
  project_name?: string | null;
  promoter?: string | null;
  locality?: string | null;
  project_status?: string | null;
  complaints_count?: number | null;
}

export interface OsmAmenity {
  osm_id?: number;
  osm_type?: string;
  amenity?: string | null;
  name?: string | null;
  lat?: number | null;
  lon?: number | null;
  tags?: Record<string, string> | null;
}

export interface PrescoredLocality {
  locality: string;
  neighbourhood_score: number;
  rera_score: number;
  amenity_score: number;
  error?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const SCORES_PATH = path.join(DATA_DIR, "scores_bangalore.json");
const RERA_PATH = path.join(DATA_DIR, "raw", "rera_projects.json");
const OSM_PATH = path.join(DATA_DIR, "raw", "osm_bangalore.json");

let _reraCache: ReraProject[] | null = null;
let _osmCache: OsmAmenity[] | null = null;
let _scoresCache: PrescoredLocality[] | null = null;

async function readJson<T>(p: string): Promise<T> {
  const buf = await fs.readFile(p, "utf-8");
  return JSON.parse(buf) as T;
}

const PAGE_SIZE = 1000;

async function fetchAllFromSupabase<T>(
  table: string,
  columns: string,
): Promise<T[]> {
  const client = supabaseClient();
  if (!client) throw new Error("Supabase not configured");

  const rows: T[] = [];
  let start = 0;
  while (true) {
    const end = start + PAGE_SIZE - 1;
    const res = await fetch(
      `${client.url}/rest/v1/${table}?select=${encodeURIComponent(columns)}`,
      {
        headers: {
          apikey: client.key,
          Authorization: `Bearer ${client.key}`,
          Range: `${start}-${end}`,
          "Range-Unit": "items",
          Prefer: "count=exact",
        },
      },
    );
    if (!res.ok) {
      throw new Error(`Supabase ${table} query failed: ${res.status}`);
    }
    const batch = (await res.json()) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  return rows;
}

export async function loadReraProjects(): Promise<ReraProject[]> {
  if (_reraCache) return _reraCache;
  if (supabaseEnabled()) {
    _reraCache = await fetchAllFromSupabase<ReraProject>(
      "rera_projects",
      "locality,project_name,complaints_count",
    );
    return _reraCache;
  }
  const data = await readJson<{ projects?: ReraProject[] }>(RERA_PATH);
  _reraCache = data.projects ?? [];
  return _reraCache;
}

export async function loadOsmAmenities(): Promise<OsmAmenity[]> {
  if (_osmCache) return _osmCache;
  if (supabaseEnabled()) {
    _osmCache = await fetchAllFromSupabase<OsmAmenity>(
      "osm_amenities",
      "lat,lon,amenity,name,tags",
    );
    return _osmCache;
  }
  const data = await readJson<{ amenities?: OsmAmenity[] }>(OSM_PATH);
  _osmCache = data.amenities ?? [];
  return _osmCache;
}

export async function loadPrescoredLocalities(): Promise<PrescoredLocality[]> {
  if (_scoresCache) return _scoresCache;
  if (supabaseEnabled()) {
    _scoresCache = await fetchAllFromSupabase<PrescoredLocality>(
      "localities",
      "locality,neighbourhood_score,rera_score,amenity_score",
    );
    return _scoresCache;
  }
  const data = await readJson<{ scores?: PrescoredLocality[] }>(SCORES_PATH);
  _scoresCache = (data.scores ?? []).filter((s) => !("error" in s) || !s.error);
  return _scoresCache;
}
