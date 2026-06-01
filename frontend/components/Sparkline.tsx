"use client";

import { generateSparkline, sparklineTrend } from "@/lib/sparkline";

export function Sparkline({
  seed,
  endValue,
  width = 80,
  height = 24,
}: {
  seed: string;
  endValue: number;
  width?: number;
  height?: number;
}) {
  const points = generateSparkline(seed, endValue);
  const trend = sparklineTrend(points);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  const trendColor =
    trend === "up" ? "#16C784" : trend === "down" ? "#EF4444" : "#666666";
  const trendLabel =
    trend === "up"
      ? "12-month trend ↑"
      : trend === "down"
        ? "12-month trend ↓"
        : "12-month trend →";

  return (
    <div className="mt-2">
      <svg width={width} height={height} className="overflow-visible">
        <path
          d={path}
          fill="none"
          stroke={trendColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="mt-1 text-[9px] uppercase tracking-wider" style={{ color: trendColor }}>
        {trendLabel}
      </p>
    </div>
  );
}
