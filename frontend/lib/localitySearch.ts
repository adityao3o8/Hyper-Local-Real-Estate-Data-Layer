import type { LocalitySummary } from "./types";

/** Always visible as quick picks in the hero */
export const FAMOUS_LOCALITIES = [
  "Indiranagar",
  "Whitefield",
  "Koramangala",
  "HSR Layout",
  "Jayanagar",
  "Electronic City",
  "Marathahalli",
  "Hebbal",
  "Yelahanka",
  "Sarjapur Road",
] as const;

const MAX_TYPEAHEAD = 5;

function findCatalogEntry(
  name: string,
  catalog: LocalitySummary[]
): LocalitySummary | undefined {
  const key = name.toLowerCase();
  const exact = catalog.find((item) => item.locality.toLowerCase() === key);
  if (exact) return exact;

  return catalog.find((item) => {
    const n = item.locality.toLowerCase();
    return n.includes(key) || key.includes(n);
  });
}

export function pickFamousLocalities(catalog: LocalitySummary[]): LocalitySummary[] {
  return FAMOUS_LOCALITIES.map((name) => {
    const hit = findCatalogEntry(name, catalog);
    if (hit) return { ...hit, locality: name };
    return {
      locality: name,
      neighbourhood_score: 0,
      rera_score: 0,
      amenity_score: 0,
    };
  });
}

/** Typeahead over full catalog (excludes famous 10 from duplicate display in dropdown) */
export function filterTypeahead(
  catalog: LocalitySummary[],
  query: string,
  famousNames: readonly string[] = FAMOUS_LOCALITIES,
  limit = MAX_TYPEAHEAD
): LocalitySummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const famousSet = new Set(famousNames.map((n) => n.toLowerCase()));

  return catalog
    .filter(
      (item) =>
        item.locality.toLowerCase().includes(q) &&
        !famousSet.has(item.locality.toLowerCase())
    )
    .sort((a, b) => {
      const aName = a.locality.toLowerCase();
      const bName = b.locality.toLowerCase();
      const aStarts = aName.startsWith(q);
      const bStarts = bName.startsWith(q);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return aName.localeCompare(bName);
    })
    .slice(0, limit);
}
