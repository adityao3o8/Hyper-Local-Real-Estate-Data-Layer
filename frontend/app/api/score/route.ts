import type { NextRequest } from "next/server";

import { errorResponse, handleException } from "@/lib/server/http";
import { GeocodeError, scoreLocality, scoreResultToDict } from "@/lib/server/scorer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const locality = searchParams.get("locality");

  if (!locality?.trim()) {
    return errorResponse(422, "locality query param is required");
  }

  try {
    const result = await scoreLocality(locality);
    return Response.json(scoreResultToDict(result));
  } catch (err) {
    if (err instanceof GeocodeError) return errorResponse(404, err.message);
    return handleException(err);
  }
}
