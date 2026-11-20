/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Rebuilds data/scores_bangalore.json after the scoring changes:
 *  - amenity score re-scaled (AMENITY_FULL_SCORE_POINTS) from the STORED counts
 *  - no-RERA-match localities: rera_score null, overall = amenity score
 *  - previously un-geocodable localities are retried with the new fallbacks (live)
 * Run: cd frontend && npx tsx evals/regenerate_scores.ts
 */
import fs from "node:fs";
import {
  AMENITY_FULL_SCORE_POINTS,
  computeReraScore,
  matchReraProjects,
  scoreLocality,
} from "../lib/server/scorer";
import { loadReraProjects } from "../lib/server/data";

const PATH = "data/scores_bangalore.json";
const raw = JSON.parse(fs.readFileSync(PATH, "utf8"));
const round1 = (n: number) => Math.round(n * 10) / 10;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let projects: Awaited<ReturnType<typeof loadReraProjects>> = [];

function rescore(e: any) {
  // Re-derive RERA fields from the CURRENT data + matcher so stored values never drift.
  const matched = matchReraProjects(projects, e.locality);
  const rr = computeReraScore(matched);
  e.rera_projects_matched = matched.length;
  e.avg_complaints = rr.avg_complaints == null ? null : Math.round(rr.avg_complaints * 100) / 100;
  e.rera_score = rr.score == null ? null : round1(rr.score);
  const c = e.amenity_counts;
  const points = c.metro * 4 + c.hospital * 3 + c.school * 2 + c.park * 2;
  const amenity = Math.max(0, Math.min(100, points * (100 / AMENITY_FULL_SCORE_POINTS)));
  const reraOk = rr.score !== null;
  const rera = e.rera_score;
  e.amenity_score = round1(amenity);
  e.rera_score = rera;
  e.rera_data_available = reraOk;
  e.neighbourhood_score = reraOk ? round1(0.45 * rera + 0.55 * amenity) : round1(amenity);
  e.details = {
    ...(e.details ?? {}),
    rera_weight: reraOk ? 0.45 : 0,
    amenity_weight: reraOk ? 0.55 : 1,
    amenity_full_score_points: AMENITY_FULL_SCORE_POINTS,
  };
  return e;
}

async function main() {
  projects = await loadReraProjects();
  const out: any[] = [];
  let retried = 0;
  let recovered = 0;
  for (const e of raw.scores) {
    if (!e.error) {
      out.push(rescore(e));
      continue;
    }
    retried++;
    try {
      await sleep(1100); // Nominatim usage policy: max 1 request/second
      const r = await scoreLocality(e.locality, { useOverpass: true });
      out.push(
        rescore({
          locality: r.locality,
          neighbourhood_score: 0,
          rera_score: r.rera_score,
          amenity_score: 0,
          rera_projects_matched: r.rera_projects_matched,
          avg_complaints: r.avg_complaints,
          amenity_counts: r.amenity_counts,
          centre: { lat: r.centre_lat, lon: r.centre_lon },
          details: r.details,
        }),
      );
      recovered++;
      console.log("recovered:", e.locality, "->", (r.details as any).geocoded_as);
    } catch (err) {
      console.log("still failing:", e.locality, "-", (err as Error).message);
      out.push(e);
    }
  }
  raw.scores = out;
  fs.writeFileSync(PATH, JSON.stringify(raw, null, 2));
  const ok = out.filter((x) => !x.error);
  const n = ok.map((x) => x.neighbourhood_score as number).sort((a, b) => a - b);
  const band = (f: (v: number) => boolean) => n.filter(f).length;
  console.log(
    `retried ${retried}, recovered ${recovered}; scored ${ok.length}/${out.length}\n` +
      `min ${n[0]} median ${n[Math.floor(n.length / 2)]} max ${n[n.length - 1]}\n` +
      `STRONG BUY ${band((v) => v > 80)} · MODERATE ${band((v) => v >= 60 && v <= 80)} · AVOID ${band((v) => v < 60)}`,
  );
  process.exit(0);
}
main();
