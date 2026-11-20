import type { NextRequest } from "next/server";

import { findPrescoredLocality } from "@/lib/server/data";
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
  scoreResultFromPrescored,
  scoreResultToDict,
} from "@/lib/server/scorer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const locality = searchParams.get("locality");

  if (!locality?.trim()) {
    return errorResponse(422, "locality query param is required");
  }

  const trimmed = locality.trim();

  // 1. Score — prefer precomputed (no Nominatim / Overpass) to avoid 504s
  let result;
  try {
    const prescored = await findPrescoredLocality(trimmed);
    result = prescored ? scoreResultFromPrescored(prescored, trimmed) : null;
    if (!result) {
      result = await scoreLocality(trimmed, { useOverpass: false });
    }
  } catch (err) {
    if (err instanceof GeocodeError) return errorResponse(404, err.message);
    return handleException(err);
  }

  const scoreData = scoreResultToDict(result);
  const serpKey = optionalSerpApiKey();

  // 2. Run AI + map pins + prices in parallel (each is best-effort where noted)
  const [aiSettled, amenitiesSettled, pricesSettled] = await Promise.allSettled([
    generateReport(scoreData, requireGroqKey()),
    buildMapAmenities(result.centre_lat, result.centre_lon, 3, 120, {
      useOverpass: false,
    }),
    serpKey
      ? fetchPropertyPrices(trimmed, serpKey)
      : Promise.resolve(null),
  ]);

  if (aiSettled.status === "rejected") {
    return handleException(aiSettled.reason);
  }
  if (amenitiesSettled.status === "rejected") {
    return handleException(amenitiesSettled.reason);
  }

  const payload: Record<string, unknown> = {
    ...scoreData,
    ai_report: aiSettled.value,
    amenities: amenitiesSettled.value,
  };

  if (pricesSettled.status === "fulfilled" && pricesSettled.value) {
    payload.property_prices = pricesSettled.value;
  } else if (serpKey && pricesSettled.status === "rejected") {
    const msg =
      pricesSettled.reason instanceof Error
        ? pricesSettled.reason.message
        : String(pricesSettled.reason);
    payload.property_prices = {
      error: `Property price lookup failed: ${msg}`,
      locality: trimmed,
      query: "",
      source: "serpapi_google_magicbricks",
      price_mentions: [],
    };
  }

  return Response.json(payload);
}
