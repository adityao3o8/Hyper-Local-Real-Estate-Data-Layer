-- Schema for the Bangalore Neighbourhood Intelligence API.
-- Run this in the Supabase SQL editor before running scripts/upload_to_supabase.py.

-- Pre-scored localities (served by GET /localities)
create table if not exists public.localities (
    locality            text primary key,
    neighbourhood_score numeric,
    rera_score          numeric,
    amenity_score       numeric,
    payload             jsonb
);

-- RERA projects used for fuzzy locality matching + complaint scoring
create table if not exists public.rera_projects (
    id               bigint generated always as identity primary key,
    locality         text,
    project_name     text,
    complaints_count integer default 0,
    payload          jsonb
);

create index if not exists rera_projects_locality_idx on public.rera_projects (locality);

-- OSM amenities used for radius-based amenity counts + map pins
create table if not exists public.osm_amenities (
    id      bigint generated always as identity primary key,
    lat     double precision,
    lon     double precision,
    amenity text,
    name    text,
    tags    jsonb
);

create index if not exists osm_amenities_geo_idx on public.osm_amenities (lat, lon);

-- Read-only public access (the API uses the service key, the browser never hits these directly).
alter table public.localities    enable row level security;
alter table public.rera_projects enable row level security;
alter table public.osm_amenities enable row level security;

create policy "read localities"    on public.localities    for select using (true);
create policy "read rera_projects" on public.rera_projects for select using (true);
create policy "read osm_amenities" on public.osm_amenities for select using (true);
