/**
 * Minimal fuzzywuzzy-compatible string similarity:
 *  - `ratio`            : Levenshtein-based whole-string ratio (0-100)
 *  - `partialRatio`     : best-window match ratio (handles substrings)
 *  - `tokenSetRatio`    : token-set comparison (handles word reordering / extras)
 */

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function ratio(a: string, b: string): number {
  if (!a && !b) return 100;
  if (!a || !b) return 0;
  const d = levenshtein(a, b);
  const lensum = a.length + b.length;
  return Math.round((100 * (lensum - d)) / lensum);
}

export function partialRatio(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const [shorter, longer] = s1.length <= s2.length ? [s1, s2] : [s2, s1];
  if (shorter.length === longer.length) return ratio(shorter, longer);

  let best = 0;
  const ln = shorter.length;
  for (let i = 0; i <= longer.length - ln; i++) {
    const window = longer.substring(i, i + ln);
    const r = ratio(shorter, window);
    if (r > best) best = r;
    if (best === 100) return 100;
  }
  return best;
}

function tokenize(s: string): Set<string> {
  return new Set(s.split(/\s+/).filter(Boolean));
}

export function tokenSetRatio(s1: string, s2: string): number {
  const t1 = tokenize(s1);
  const t2 = tokenize(s2);
  const intersection = [...t1].filter((x) => t2.has(x)).sort();
  const diff1 = [...t1].filter((x) => !t2.has(x)).sort();
  const diff2 = [...t2].filter((x) => !t1.has(x)).sort();

  const inter = intersection.join(" ");
  const combined1 = [...intersection, ...diff1].join(" ").trim();
  const combined2 = [...intersection, ...diff2].join(" ").trim();

  return Math.max(
    ratio(inter, combined1),
    ratio(inter, combined2),
    ratio(combined1, combined2),
  );
}
