import type { NextRequest } from "next/server";

import {
  errorResponse,
  handleException,
  optionalSerpApiKey,
  requireGroqKey,
} from "@/lib/server/http";
import { fetchPropertyPrices } from "@/lib/server/property-prices";
import { generateReport } from "@/lib/server/report-generator";
import {
  GeocodeError,
  buildMapAmenities,
  scoreLocality,
  scoreResultToDict,
} from "@/lib/server/scorer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Scoring + Groq + Overpass + (optionally) SerpAPI can be slow.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const locality = searchParams.get("locality");

  if (!locality?.trim()) {
    return errorResponse(422, "locality query param is required");
  }

  // 1. Score
  let result;
  try {
    result = await scoreLocality(locality);
  } catch (err) {
    if (err instanceof GeocodeError) return errorResponse(404, err.message);
    return handleException(err);
  }

  const scoreData = scoreResultToDict(result);

  // 2. AI report (Groq)
  let aiReport: string;
  try {
    aiReport = await generateReport(scoreData, requireGroqKey());
  } catch (err) {
    return handleException(err);
  }

  // 3. Map amenities
  let mapAmenities;
  try {
    mapAmenities = await buildMapAmenities(result.centre_lat, result.centre_lon);
  } catch (err) {
    return handleException(err);
  }

  const payload: Record<string, unknown> = {
    ...scoreData,
    ai_report: aiReport,
    amenities: mapAmenities,
  };

  // 4. Best-effort property prices
  const serpKey = optionalSerpApiKey();
  if (serpKey) {
    try {
      payload.property_prices = await fetchPropertyPrices(locality, serpKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      payload.property_prices = {
        error: `Property price lookup failed: ${msg}`,
        locality,
        query: "",
        source: "serpapi_google_magicbricks",
        price_mentions: [],
      };
    }
  }

  return Response.json(payload);
}
