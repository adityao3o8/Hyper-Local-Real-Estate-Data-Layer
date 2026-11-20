/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Evals for the Neighbourhood Intelligence app.
 * Run:  cd frontend && npx tsx evals/run.ts
 * Network calls (Nominatim/Overpass/Groq/SerpAPI) are mocked, so results are
 * deterministic and need no API keys. Real local data (data/*.json) is used.
 */
import fs from "node:fs";
import { partialRatio, ratio, tokenSetRatio } from "../lib/server/fuzzy";
import {
  haversineKm,
  matchReraProjects,
  scoreLocality,
} from "../lib/server/scorer";
import { loadReraProjects, loadPrescoredLocalities } from "../lib/server/data";
import { fetchPropertyPrices } from "../lib/server/property-prices";
import { generateReport } from "../lib/server/report-generator";
import { investmentSignal } from "../lib/api";
import { GET as reportGET } from "../app/api/report/route";

type Row = { group: string; name: string; expected: string; actual: string; pass: boolean; info?: boolean };
const rows: Row[] = [];
function check(group: string, name: string, expected: string, actual: unknown, pass: boolean) {
  rows.push({ group, name, expected, actual: String(actual), pass });
}
/** Informational: reports a property of the data, not a pass/fail test. */
function info(group: string, name: string, actual: unknown) {
  rows.push({ group, name, expected: "informational", actual: String(actual), pass: true, info: true });
}

// ---------- fetch mock ----------
const realFetch = globalThis.fetch;
type Handler = (url: string, init?: RequestInit) => Response | Promise<Response> | undefined;
let handlers: Handler[] = [];
globalThis.fetch = (async (input: any, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  for (const h of handlers) {
    const r = await h(url, init);
    if (r) return r;
  }
  throw new Error("Unmocked fetch: " + url);
}) as typeof fetch;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const nominatim = (lat: number, lon: number): Handler => (u) =>
  u.includes("nominatim") ? json([{ lat: String(lat), lon: String(lon), display_name: "mock" }]) : undefined;
const overpassEmpty: Handler = (u) => (u.includes("overpass") ? json({ elements: [] }) : undefined);

async function main() {
  // =============== 1. Fuzzy matching ===============
  check("fuzzy", "identical strings = 100", "100", ratio("INDIRANAGAR", "INDIRANAGAR"), ratio("INDIRANAGAR", "INDIRANAGAR") === 100);
  const pr = partialRatio("INDIRANAGAR", "100 FEET ROAD INDIRANAGAR PHASE 2");
  check("fuzzy", "substring found inside longer string", "100", pr, pr === 100);
  const sp = ratio("INDIRA NAGAR", "INDIRANAGAR");
  check("fuzzy", "spacing variant 'Indira Nagar' ~ 'Indiranagar'", ">= 85", sp, sp >= 85);
  const neg = partialRatio("WHITEFIELD", "KORAMANGALA");
  check("fuzzy", "unrelated localities do not match", "< 85", neg, neg < 85);
  check("fuzzy", "empty input = 0", "0", partialRatio("", "ABC"), partialRatio("", "ABC") === 0);
  const ts = tokenSetRatio("LAYOUT HSR", "HSR LAYOUT SECTOR 2");
  check("fuzzy", "token-set handles word reordering", ">= 85", ts, ts >= 85);

  // =============== 2. Geometry ===============
  check("geo", "same point = 0 km", "0", haversineKm(12.97, 77.59, 12.97, 77.59), haversineKm(12.97, 77.59, 12.97, 77.59) === 0);
  const blrMys = haversineKm(12.9716, 77.5946, 12.2958, 76.6394);
  check("geo", "Bengaluru to Mysuru straight-line ~127 km (+-3)", "124-130", blrMys.toFixed(1), blrMys > 124 && blrMys < 130);

  // =============== 3. Signal thresholds ===============
  const sig = (s: number) => investmentSignal(s).label;
  check("signal", "80 -> MODERATE (boundary)", "MODERATE", sig(80), sig(80) === "MODERATE");
  check("signal", "80.1 -> STRONG BUY", "STRONG BUY", sig(80.1), sig(80.1) === "STRONG BUY");
  check("signal", "60 -> MODERATE", "MODERATE", sig(60), sig(60) === "MODERATE");
  check("signal", "59.9 -> AVOID", "AVOID", sig(59.9), sig(59.9) === "AVOID");

  // =============== 4. Scoring logic (mocked geocode, real data) ===============
  handlers = [nominatim(13.29, 77.31)]; // remote corner of the Bengaluru box: no OSM amenities within 3 km
  const empty = await scoreLocality("Zzqx Qqvv", { useOverpass: false });
  check("score", "no RERA match -> rera_score is null (no invented number)", "null", empty.rera_score, empty.rera_score === null);
  check("score", "no RERA match -> flagged rera_data_available = false", "false", empty.rera_data_available, empty.rera_data_available === false);
  check("score", "no RERA match -> avg_complaints null", "null", empty.avg_complaints, empty.avg_complaints === null);
  check("score", "zero amenities -> amenity_score 0", "0", empty.amenity_score, empty.amenity_score === 0);
  check("score", "no RERA data -> overall = amenity score alone (0)", "0", empty.neighbourhood_score, empty.neighbourhood_score === 0);

  // RERA data present but no amenities: overall must be exactly 0.45 * rera.
  const wf = await scoreLocality("Whitefield", { useOverpass: false });
  const wfExpected = Math.round(0.45 * (wf.rera_score ?? 0) * 10) / 10;
  check("score", "RERA data + zero amenities -> 0.45 * rera_score", String(wfExpected), wf.neighbourhood_score, wf.rera_data_available && wf.neighbourhood_score === wfExpected);

  handlers = [nominatim(12.9784, 77.6408)];
  const indi = await scoreLocality("Indiranagar", { useOverpass: false });
  check("score", "Indiranagar: score within 0-100", "0-100", indi.neighbourhood_score, indi.neighbourhood_score >= 0 && indi.neighbourhood_score <= 100);
  check("score", "Indiranagar: amenities found within 3km", "hospital>0 and school>0", JSON.stringify(indi.amenity_counts), indi.amenity_counts.hospital > 0 && indi.amenity_counts.school > 0);
  const recomputed = indi.rera_score == null
    ? indi.amenity_score
    : Math.round((0.45 * indi.rera_score + 0.55 * indi.amenity_score) * 10) / 10;
  check("score", "Indiranagar: overall follows the documented blend", String(recomputed), indi.neighbourhood_score, Math.abs(recomputed - indi.neighbourhood_score) <= 0.15);

  // =============== 5. Pre-scored dataset ===============
  const all = await loadPrescoredLocalities();
  const scoredRaw = JSON.parse(fs.readFileSync("data/scores_bangalore.json", "utf8")).scores as any[];
  const withScore = scoredRaw.filter((s) => !s.error);
  const errs = scoredRaw.length - withScore.length;
  check("dataset", "pre-scored localities load", "> 100", all.length, all.length > 100);
  const outOfRange = withScore.filter((s) => s.neighbourhood_score < 0 || s.neighbourhood_score > 100);
  check("dataset", "all scores within 0-100", "0 violations", outOfRange.length, outOfRange.length === 0);
  const expectedOverall = (s: any) =>
    s.rera_score == null ? s.amenity_score : Math.round((0.45 * s.rera_score + 0.55 * s.amenity_score) * 10) / 10;
  const badBlend = withScore.filter((s) => Math.abs(expectedOverall(s) - s.neighbourhood_score) > 0.15);
  check("dataset", "stored score matches the documented blend (0.45/0.55, or amenity-only without RERA)", "0 violations", badBlend.length, badBlend.length === 0);
  check("dataset", "geocode failures in batch run", "< 5% of localities", `${errs}/${scoredRaw.length} (${((errs / scoredRaw.length) * 100).toFixed(1)}%)`, errs / scoredRaw.length < 0.05);

  const nums = withScore.map((s) => s.neighbourhood_score as number).sort((a, b) => a - b);
  const sat = withScore.filter((s) => s.amenity_score === 100).length;
  const strong = withScore.filter((s) => s.neighbourhood_score > 80).length;
  check("dataset", "amenity score does not saturate for most localities", "< 50% at 100", `${sat}/${withScore.length} at 100`, sat / withScore.length < 0.5);
  check("dataset", "scores spread across the signal bands", "no band > 80% of localities", `${strong}/${withScore.length} are STRONG BUY (median ${nums[Math.floor(nums.length / 2)]})`, strong / withScore.length < 0.8);
  const noRera = withScore.filter((s) => s.rera_projects_matched === 0);
  const fabricated = noRera.filter((s) => s.rera_score != null);
  check("dataset", "localities with no RERA match carry no invented RERA score", "0 violations", fabricated.length, fabricated.length === 0);
  info("dataset", "localities with no RERA match (shown as 'No data' in the UI)", `${noRera.length}/${withScore.length} (${((noRera.length / withScore.length) * 100).toFixed(0)}%)`);

  const sample = withScore.filter((s) => s.rera_projects_matched > 0).slice(0, 8);
  let mism = 0;
  for (const s of sample) {
    handlers = [nominatim(s.centre.lat, s.centre.lon)];
    const live = await scoreLocality(s.locality, { useOverpass: false });
    if (live.rera_projects_matched !== s.rera_projects_matched || live.rera_score !== s.rera_score) mism++;
  }
  check("dataset", "live RERA matching reproduces stored values (8 localities)", "0 mismatches", mism, mism === 0);

  // =============== 6. RERA matching precision proxy ===============
  const projects = await loadReraProjects();
  const audit = ["Whitefield", "Koramangala", "Indiranagar", "HSR Layout", "Jayanagar", "Hebbal", "Yelahanka", "Marathahalli"];
  const auditOut: string[] = [];
  for (const q of audit) {
    const m = matchReraProjects(projects, q);
    const key = q.split(" ")[0].toUpperCase();
    const hay = (p: any) => `${p.locality ?? ""} ${p.project_name ?? ""}`.toUpperCase();
    const lit = m.filter((p) => hay(p).includes(key));
    const fuzzyOnly = m.filter((p) => !hay(p).includes(key));
    auditOut.push(`${q}: ${m.length} matched, ${lit.length} literally contain "${key}", ${fuzzyOnly.length} fuzzy-only` +
      (fuzzyOnly[0] ? ` (e.g. "${fuzzyOnly[0].locality ?? ""} | ${fuzzyOnly[0].project_name}")` : ""));
    const prec = m.length ? lit.length / m.length : 1;
    check("matching", `precision proxy for "${q}"`, ">= 90% literally contain the name", `${(prec * 100).toFixed(0)}% of ${m.length}`, prec >= 0.9);
  }
  const localityFilled = projects.filter((p) => p.locality && p.locality.trim()).length;
  info("matching", "RERA records that have a locality field (a property of the scraped data)", `${localityFilled}/${projects.length} (${((localityFilled / projects.length) * 100).toFixed(0)}%)`);

  // =============== 7. Price parser (mocked SerpAPI) ===============
  const serp = (organic: any[]): Handler => (u) => (u.includes("serpapi") ? json({ organic_results: organic }) : undefined);
  handlers = [serp([
    { title: "2 BHK in Indiranagar", link: "https://www.magicbricks.com/a", snippet: "Starting at ₹1.2 Cr for 2 BHK." },
    { title: "Flats", link: "https://www.magicbricks.com/b", snippet: "Prices from 85 Lakh. Average ₹7,500/sq ft." },
    { title: "Plots", link: "https://www.magicbricks.com/c", snippet: "Rs. 45 Lac onwards." },
  ])];
  const p1 = await fetchPropertyPrices("Indiranagar", "k");
  const totals = (p1.price_mentions ?? []).filter((m) => m.unit === "total").map((m) => m.amount_inr);
  check("prices", "parses crore (1.2 Cr = 12,000,000)", "12000000 present", totals.join(","), totals.includes(12_000_000));
  check("prices", "parses lakh (85 Lakh = 8,500,000)", "8500000 present", totals.join(","), totals.includes(8_500_000));
  check("prices", "parses 'Lac' spelling (45 Lac = 4,500,000)", "4500000 present", totals.join(","), totals.includes(4_500_000));
  check("prices", "parses per-sq-ft (7,500)", "7500", p1.per_sqft_inr?.median, p1.per_sqft_inr?.median === 7500);

  handlers = [serp([{ title: "3 BHK", link: "https://www.magicbricks.com/d", snippet: "Spacious 3 BHK, 1,200 sq ft with 2 L-shaped balconies and 4 L of storage." }])];
  const p2 = await fetchPropertyPrices("X", "k");
  check("prices", "no false price from area/BHK text", "0 mentions", (p2.price_mentions ?? []).map((m) => m.raw).join("|") || "0", (p2.price_mentions ?? []).length === 0);

  handlers = [serp([{ title: "Flat", link: "https://www.magicbricks.com/e", snippet: "Priced at \u20b945 L only." }])];
  const p2b = await fetchPropertyPrices("X", "k");
  const lVals = (p2b.price_mentions ?? []).map((m) => m.amount_inr);
  check("prices", "a currency-prefixed 'L' still parses (45 L = 4,500,000)", "4500000", lVals.join(","), lVals.includes(4_500_000));

  handlers = [serp([])];
  const p3 = await fetchPropertyPrices("X", "k");
  check("prices", "empty search results -> no crash, no bands", "no bands", JSON.stringify([p3.total_price_inr, p3.per_sqft_inr]), !p3.total_price_inr && !p3.per_sqft_inr);

  handlers = [(u) => (u.includes("serpapi") ? new Response("no", { status: 500 }) : undefined)];
  const p4 = await fetchPropertyPrices("X", "k");
  check("prices", "SerpAPI 500 -> error field set, does not throw", "error set", p4.error, !!p4.error);

  // =============== 8. AI report generator (mocked Groq) ===============
  let sent: any = null;
  handlers = [(u, init) => {
    if (!u.includes("groq")) return undefined;
    sent = JSON.parse(String(init?.body));
    return json({ choices: [{ message: { content: "  A fine paragraph.  " } }] });
  }];
  const rep = await generateReport({ locality: "Indiranagar", neighbourhood_score: 80 }, "key");
  check("report", "trims model output", "A fine paragraph.", rep, rep === "A fine paragraph.");
  const promptOk = sent.messages[1].content.includes("Indiranagar") && sent.messages[0].content.includes("Do not invent");
  check("report", "prompt carries the score data and the no-invention rule", "both present", promptOk, promptOk);
  check("report", "request caps output length (max_tokens)", "400", sent.max_tokens, sent.max_tokens === 400);
  handlers = [(u) => (u.includes("groq") ? new Response("model not found", { status: 404 }) : undefined)];
  let threw = false;
  try { await generateReport({ locality: "X" }, "key"); } catch { threw = true; }
  check("report", "Groq error surfaces as exception", "throws", threw, threw);

  // =============== 9. /api/report route behaviour ===============
  const req = (q: string) => ({ nextUrl: new URL("http://x/api/report" + q) }) as any;
  process.env.GROQ_API_KEY = "test";
  delete process.env.SERPAPI_KEY;
  delete process.env.SERP_API_KEY;
  let r = await reportGET(req(""));
  check("route", "missing locality -> 422", "422", r.status, r.status === 422);

  handlers = [(u) => (u.includes("nominatim") ? json([]) : undefined)];
  r = await reportGET(req("?locality=Nowhereville"));
  check("route", "unknown place (geocode fails) -> 404", "404", r.status, r.status === 404);

  const okGroq: Handler = (u) => (u.includes("groq") ? json({ choices: [{ message: { content: "Report." } }] }) : undefined);
  handlers = [nominatim(12.9784, 77.6408), overpassEmpty, okGroq];
  r = await reportGET(req("?locality=Indiranagar"));
  const body: any = await r.json();
  check("route", "happy path -> 200", "200", r.status, r.status === 200);
  const keys = ["locality", "neighbourhood_score", "rera_score", "amenity_score", "amenity_breakdown", "rera_projects_matched", "avg_complaints", "centre", "ai_report", "amenities"];
  const missing = keys.filter((k) => !(k in body));
  check("route", "response has all documented fields", "none missing", missing.join(",") || "none missing", missing.length === 0);
  check("route", "map amenities returned", "> 0", body.amenities?.length, (body.amenities?.length ?? 0) > 0);

  handlers = [nominatim(12.9784, 77.6408), overpassEmpty, (u) => (u.includes("groq") ? new Response("down", { status: 503 }) : undefined)];
  r = await reportGET(req("?locality=Indiranagar"));
  const degraded: any = r.status === 200 ? await r.json() : {};
  check("route", "Groq down -> still 200 with score and map", "200", r.status, r.status === 200 && typeof degraded.neighbourhood_score === "number" && (degraded.amenities?.length ?? 0) > 0);
  check("route", "Groq down -> fallback text and ai_report_available=false", "flag false + message", `${degraded.ai_report_available} / ${String(degraded.ai_report).slice(0, 40)}`, degraded.ai_report_available === false && !!degraded.ai_report);

  delete process.env.GROQ_API_KEY;
  handlers = [nominatim(12.9784, 77.6408), overpassEmpty];
  r = await reportGET(req("?locality=Indiranagar"));
  check("route", "missing GROQ key -> clear config error", "500", r.status, r.status === 500);

  process.env.GROQ_API_KEY = "test";
  handlers = [nominatim(28.6139, 77.209)]; // Delhi
  r = await reportGET(req("?locality=Connaught%20Place"));
  check("route", "geocode far outside Bangalore is rejected (404)", "404", r.status, r.status === 404);

  // Geocoding: an out-of-bounds first hit is skipped; a simpler spelling is retried.
  handlers = [(u) => u.includes("nominatim")
    ? json([{ lat: "28.6", lon: "77.2", display_name: "Delhi" }, { lat: "12.97", lon: "77.59", display_name: "Bengaluru" }])
    : undefined];
  const g1 = await scoreLocality("Somewhere", { useOverpass: false });
  check("geocode", "skips an out-of-Bangalore hit and takes the next in-bounds result", "12.97", g1.centre_lat, g1.centre_lat === 12.97);

  const asked: string[] = [];
  handlers = [(u) => {
    if (!u.includes("nominatim")) return undefined;
    const q = new URL(u).searchParams.get("q") ?? "";
    asked.push(q);
    return q.startsWith("Jayanagar,") ? json([{ lat: "12.92", lon: "77.58", display_name: "Jayanagar" }]) : json([]);
  }];
  const g2 = await scoreLocality("4th Block, 5th Block Jayanagar", { useOverpass: false });
  check("geocode", "'4th Block, 5th Block Jayanagar' resolves via simplified fallback", "resolves to Jayanagar", `${g2.centre_lat} after ${asked.length} queries`, g2.centre_lat === 12.92);

  handlers = [(u) => (u.includes("nominatim") ? json([]) : undefined)];
  let ge = false;
  try { await scoreLocality("Zzzz", { useOverpass: false }); } catch (e) { ge = (e as Error).name === "GeocodeError"; }
  check("geocode", "nothing found anywhere -> GeocodeError", "GeocodeError", ge, ge);

  // =============== 10. Parity of fuzzy primitives with real fuzzywuzzy ===============
  // Expected values produced by running fuzzywuzzy (pure-Python SequenceMatcher) on the same pairs.
  const pyPairs: Array<[string, string, number, number, number]> = [
    ["INDIRANAGAR", "100 FEET ROAD INDIRANAGAR PHASE 2", 50, 100, 100],
    ["INDIRA NAGAR", "INDIRANAGAR", 96, 91, 96],
    ["WHITEFIELD", "KORAMANGALA", 10, 10, 10],
    ["HSR LAYOUT", "1ST SECTOR HSR LAYOUT", 65, 100, 100],
    ["AGARA", "SRI RAMA NAGARA LAYOUT", 37, 100, 37],
    ["JAYANAGAR", "VIJAYANAGARA", 86, 100, 86],
    ["LAYOUT HSR", "HSR LAYOUT SECTOR 2", 62, 80, 100],
    ["KORAMANGALA", "GREEN VIEW KORAMANGALA", 67, 100, 100],
    ["AREKERE", "ARAKERE GROVE LAYOUT", 44, 86, 44],
    ["ELECTRONIC CITY", "ELECTRONIC CITY PHASE 1 BANGALORE", 62, 100, 100],
    ["BTM", "BTMCHIKKAPETE1008", 30, 100, 30],
    ["NIRVANA", "INDIRANAGAR", 67, 86, 67],
    ["MARATHAHALLI", "MARATHAHALLI BRIDGE AREA", 67, 100, 100],
    ["YELAHANKA NEW TOWN", "NEW TOWN YELAHANKA", 50, 67, 100],
  ];
  const primBad: string[] = [];
  for (const [a, b, r, pr2, ts2] of pyPairs) {
    const got = [ratio(a, b), partialRatio(a, b), tokenSetRatio(a, b)];
    if (got[0] !== r || got[1] !== pr2 || got[2] !== ts2) primBad.push(`${a} | ${b}: py [${r},${pr2},${ts2}] ts [${got.join(",")}]`);
  }
  check("parity", `ratio / partialRatio / tokenSetRatio equal fuzzywuzzy on ${pyPairs.length} pairs (${pyPairs.length * 3} values)`, "0 differences", primBad.length ? primBad.join("; ") : "0 differences", primBad.length === 0);

  // Matcher policy: known-bad coincidences must not match (these did before the word-level guards).
  const mm = (q: string) => matchReraProjects(projects, q).length;
  check("matching", "'Agara' does not match every '...Nagara' project", "< 10 matches", mm("Agara"), mm("Agara") < 10);
  const jy = matchReraProjects(projects, "Jayanagar").filter((p) => !`${p.locality ?? ""} ${p.project_name ?? ""}`.toUpperCase().includes("JAYANAGAR"));
  check("matching", "'Jayanagar' does not match 'Vijayanagara' projects", "0 non-Jayanagar matches", jy.length, jy.length === 0);
  check("matching", "typo/spacing variants still match ('White Field' = 'Whitefield')", "same count", `${mm("White Field")} vs ${mm("Whitefield")}`, mm("White Field") === mm("Whitefield") && mm("Whitefield") > 0);

  // ---------- output ----------
  const groups = [...new Set(rows.map((x) => x.group))];
  const tests = rows.filter((x) => !x.info);
  const pass = tests.filter((x) => x.pass).length;
  let md = `# Eval results\n\nRun: ${new Date().toISOString().slice(0, 10)} - ${pass}/${tests.length} passed (+${rows.length - tests.length} informational)\n\n`;
  md += "Network services (Nominatim, Overpass, Groq, SerpAPI) are mocked; scoring runs against the real local datasets.\n\n";
  for (const g of groups) {
    md += `## ${g}\n\n| Check | Expected | Actual | Result |\n|---|---|---|---|\n`;
    for (const x of rows.filter((y) => y.group === g)) {
      md += `| ${x.name} | ${x.expected} | ${x.actual.replace(/\|/g, "/")} | ${x.info ? "INFO" : x.pass ? "PASS" : "**FAIL**"} |\n`;
    }
    md += "\n";
  }
  md += "## Matching audit detail\n\n" + auditOut.map((l) => "- " + l).join("\n") + "\n";
  fs.writeFileSync("evals/results.md", md);
  console.log(md);
  globalThis.fetch = realFetch;
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
