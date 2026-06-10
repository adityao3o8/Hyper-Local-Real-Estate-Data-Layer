import type {
  AmenitiesResponse,
  LocalitiesResponse,
  PropertyPricesSummary,
  ReportResponse,
} from "./types";

/** Backend base URL — set `NEXT_PUBLIC_API_URL` in production. */
export function getApiBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return "http://localhost:8000";
}

const API_BASE = getApiBase();

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

export async function fetchPropertyPrices(
  locality: string
): Promise<PropertyPricesSummary> {
  const params = new URLSearchParams({ locality: locality.trim() });
  const response = await fetch(`${API_BASE}/property-price?${params}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : `Property prices failed (${response.status})`;
    throw new Error(detail);
  }

  return response.json();
}

/** Report + property prices (one SerpAPI call if report already includes prices). */
export async function fetchReportWithPrices(
  locality: string
): Promise<ReportResponse> {
  const data = await fetchReport(locality);
  const hasPrices =
    data.property_prices &&
    ((data.property_prices.price_mentions?.length ?? 0) > 0 ||
      data.property_prices.total_price_inr);

  if (hasPrices) return data;

  try {
    data.property_prices = await fetchPropertyPrices(locality);
  } catch {
    data.property_prices = {
      locality,
      query: "",
      source: "serpapi_google_magicbricks",
      price_mentions: [],
      error: "Property price lookup failed",
    };
  }

  return data;
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
