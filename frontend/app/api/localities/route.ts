import { loadPrescoredLocalities } from "@/lib/server/data";
import { handleException } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const all = await loadPrescoredLocalities();
    const items = all
      .filter((e) => !("error" in e) || !e.error)
      .map((e) => ({
        locality: e.locality,
        neighbourhood_score: e.neighbourhood_score,
        rera_score: e.rera_score,
        amenity_score: e.amenity_score,
      }));
    return Response.json({ count: items.length, localities: items });
  } catch (err) {
    return handleException(err);
  }
}
