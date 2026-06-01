/** Deterministic fake 12-month trend from a seed string. */
export function generateSparkline(seed: string, endValue: number): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const points: number[] = [];
  let value = endValue * (0.72 + (Math.abs(hash % 100) / 100) * 0.18);

  for (let i = 0; i < 12; i++) {
    hash = (hash * 1103515245 + 12345) | 0;
    const noise = ((hash % 200) - 100) / 100;
    value = Math.max(20, Math.min(100, value + noise * 4 + (endValue - value) * 0.08));
    points.push(Math.round(value * 10) / 10);
  }

  points[11] = endValue;
  return points;
}

export function sparklineTrend(points: number[]): "up" | "down" | "flat" {
  if (points.length < 2) return "flat";
  const delta = points[points.length - 1] - points[0];
  if (delta > 2) return "up";
  if (delta < -2) return "down";
  return "flat";
}
