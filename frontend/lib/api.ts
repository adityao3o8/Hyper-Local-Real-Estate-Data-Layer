import type { AmenitiesResponse, LocalitiesResponse, ReportResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const NOT_FOUND_MESSAGE =
  "No data yet for this area. Try Indiranagar, Whitefield or Koramangala.";

export async function fetchLocalities(): Promise<LocalitiesResponse> {
  const response = await fetch(`${API_BASE}/localities`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to load localities (${response.status})`);
  }

  return response.json();
}

export async function fetchReport(locality: string): Promise<ReportResponse> {
  const params = new URLSearchParams({ locality: locality.trim() });
  const response = await fetch(`${API_BASE}/report?${params}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : `Request failed (${response.status})`;

    if (
      response.status === 404 ||
      detail.toLowerCase().includes("geocode") ||
      detail.toLowerCase().includes("could not geocode")
    ) {
      throw new Error(NOT_FOUND_MESSAGE);
    }

    throw new Error(detail);
  }

  return response.json();
}

export function scoreColor(score: number): string {
  if (score > 75) return "#16C784";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

export function investmentSignal(score: number): {
  label: string;
  color: string;
} {
  if (score > 80) return { label: "STRONG BUY", color: "#16C784" };
  if (score >= 60) return { label: "MODERATE", color: "#F59E0B" };
  return { label: "AVOID", color: "#EF4444" };
}

export async function fetchAmenities(
  lat: number,
  lon: number,
  radiusKm = 3
): Promise<AmenitiesResponse> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius_km: String(radiusKm),
  });
  const response = await fetch(`${API_BASE}/amenities?${params}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load amenities (${response.status})`);
  }
  return response.json();
}
