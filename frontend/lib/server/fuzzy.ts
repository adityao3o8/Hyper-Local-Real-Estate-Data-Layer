/**
 * fuzzywuzzy-compatible string similarity (v0.18, pure-Python SequenceMatcher path).
 *
 * This is a faithful port of Python's difflib.SequenceMatcher (longest-matching-
 * blocks, not edit distance) plus fuzzywuzzy's ratio / partial_ratio /
 * token_set_ratio, so TypeScript results match the original Python pipeline.
 *
 *  - ratio          : SequenceMatcher ratio, 0-100
 *  - partialRatio   : best aligned window of the shorter string in the longer
 *  - tokenSetRatio  : token-set comparison (handles word reordering / extras)
 */

/** Python 3 round(): ties go to the nearest even integer. */
function pyRound(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

type Block = [number, number, number]; // [i, j, size]

class SequenceMatcher {
  private a: string;
  private b: string;
  private b2j = new Map<string, number[]>();

  constructor(a: string, b: string) {
    this.a = a;
    this.b = b;
    for (let j = 0; j < b.length; j++) {
      const ch = b[j];
      const list = this.b2j.get(ch);
      if (list) list.push(j);
      else this.b2j.set(ch, [j]);
    }
    // difflib autojunk: drop very common elements for long sequences.
    const n = b.length;
    if (n >= 200) {
      const ntest = Math.floor(n / 100) + 1;
      for (const [ch, idxs] of [...this.b2j]) {
        if (idxs.length > ntest) this.b2j.delete(ch);
      }
    }
  }

  private findLongestMatch(alo: number, ahi: number, blo: number, bhi: number): Block {
    const { a, b, b2j } = this;
    let besti = alo;
    let bestj = blo;
    let bestsize = 0;
    let j2len = new Map<number, number>();
    for (let i = alo; i < ahi; i++) {
      const newj2len = new Map<number, number>();
      const idxs = b2j.get(a[i]);
      if (idxs) {
        for (const j of idxs) {
          if (j < blo) continue;
          if (j >= bhi) break;
          const k = (j2len.get(j - 1) ?? 0) + 1;
          newj2len.set(j, k);
          if (k > bestsize) {
            besti = i - k + 1;
            bestj = j - k + 1;
            bestsize = k;
          }
        }
      }
      j2len = newj2len;
    }
    // Extend with equal elements (matters only after autojunk removed some).
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
      besti--;
      bestj--;
      bestsize++;
    }
    while (
      besti + bestsize < ahi &&
      bestj + bestsize < bhi &&
      a[besti + bestsize] === b[bestj + bestsize]
    ) {
      bestsize++;
    }
    return [besti, bestj, bestsize];
  }

  matchingBlocks(): Block[] {
    const la = this.a.length;
    const lb = this.b.length;
    const queue: Array<[number, number, number, number]> = [[0, la, 0, lb]];
    const found: Block[] = [];
    while (queue.length) {
      const [alo, ahi, blo, bhi] = queue.pop()!;
      const [i, j, k] = this.findLongestMatch(alo, ahi, blo, bhi);
      if (k) {
        found.push([i, j, k]);
        if (alo < i && blo < j) queue.push([alo, i, blo, j]);
        if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
      }
    }
    found.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);

    // Collapse adjacent blocks, as difflib does.
    const out: Block[] = [];
    let [i1, j1, k1] = [0, 0, 0];
    for (const [i2, j2, k2] of found) {
      if (i1 + k1 === i2 && j1 + k1 === j2) {
        k1 += k2;
      } else {
        if (k1) out.push([i1, j1, k1]);
        [i1, j1, k1] = [i2, j2, k2];
      }
    }
    if (k1) out.push([i1, j1, k1]);
    out.push([la, lb, 0]);
    return out;
  }

  /** 0..1 */
  ratio(): number {
    const length = this.a.length + this.b.length;
    if (!length) return 1.0;
    const matches = this.matchingBlocks().reduce((s, blk) => s + blk[2], 0);
    return (2.0 * matches) / length;
  }
}

export function ratio(a: string, b: string): number {
  return pyRound(100 * new SequenceMatcher(a, b).ratio());
}

export function partialRatio(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const [shorter, longer] = s1.length <= s2.length ? [s1, s2] : [s2, s1];
  const blocks = new SequenceMatcher(shorter, longer).matchingBlocks();
  const scores: number[] = [];
  for (const [i, j] of blocks) {
    const longStart = j - i > 0 ? j - i : 0;
    const longSubstr = longer.slice(longStart, longStart + shorter.length);
    const r = new SequenceMatcher(shorter, longSubstr).ratio();
    if (r > 0.995) return 100;
    scores.push(r);
  }
  return pyRound(100 * Math.max(...scores));
}

/** fuzzywuzzy utils.full_process (ASCII): non-alphanumerics -> space, lowercase, trim. */
function fullProcess(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, " ").toLowerCase().trim();
}

export function tokenSetRatio(s1: string, s2: string): number {
  const p1 = fullProcess(s1);
  const p2 = fullProcess(s2);
  if (!p1 || !p2) return 0;

  const t1 = new Set(p1.split(/\s+/).filter(Boolean));
  const t2 = new Set(p2.split(/\s+/).filter(Boolean));
  const inter = [...t1].filter((x) => t2.has(x)).sort();
  const d12 = [...t1].filter((x) => !t2.has(x)).sort();
  const d21 = [...t2].filter((x) => !t1.has(x)).sort();

  const sortedSect = inter.join(" ");
  const combined12 = `${sortedSect} ${d12.join(" ")}`.trim();
  const combined21 = `${sortedSect} ${d21.join(" ")}`.trim();
  const sect = sortedSect.trim();

  return Math.max(
    ratio(sect, combined12),
    ratio(sect, combined21),
    ratio(combined12, combined21),
  );
}
