import type { NextRequest } from "next/server";

import {
  errorResponse,
  handleException,
  requireSerpApiKey,
} from "@/lib/server/http";
import { fetchPropertyPrices } from "@/lib/server/property-prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const locality = searchParams.get("locality");
  const site = searchParams.get("site") ?? "magicbricks.com";

  if (!locality?.trim()) {
    return errorResponse(422, "locality query param is required");
  }

  try {
    const apiKey = requireSerpApiKey();
    const summary = await fetchPropertyPrices(locality, apiKey, site);
    return Response.json(summary);
  } catch (err) {
    return handleException(err);
  }
}
