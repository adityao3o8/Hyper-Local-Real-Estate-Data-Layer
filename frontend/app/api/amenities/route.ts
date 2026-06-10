import type { NextRequest } from "next/server";

import { errorResponse, handleException } from "@/lib/server/http";
import { buildMapAmenities } from "@/lib/server/scorer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lon") ?? "");
  const radiusKm = parseFloat(searchParams.get("radius_km") ?? "3");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return errorResponse(422, "lat and lon query params are required");
  }
  if (!Number.isFinite(radiusKm) || radiusKm < 0.5 || radiusKm > 10) {
    return errorResponse(422, "radius_km must be between 0.5 and 10");
  }

  try {
    const points = await buildMapAmenities(lat, lon, radiusKm);
    return Response.json({ count: points.length, amenities: points });
  } catch (err) {
    return handleException(err);
  }
}
