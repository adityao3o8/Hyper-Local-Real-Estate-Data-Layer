"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { scoreColor } from "@/lib/api";

function ScoreArc({
  radius,
  score,
  color,
  delay,
  inView,
}: {
  radius: number;
  score: number;
  color: string;
  delay: number;
  inView: boolean;
}) {
  const cx = 120;
  const cy = 120;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (score / 100) * circumference;

  return (
    <g>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={8} />
      <motion.circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={circumference}
        transform={`rotate(-90 ${cx} ${cy})`}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: inView ? targetOffset : circumference }}
        transition={{ duration: 1.4, delay, ease: [0.22, 1, 0.36, 1] }}
        style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
      />
    </g>
  );
}

export function ScoreRadialChart({
  overall,
  amenity,
  rera,
}: {
  overall: number;
  amenity: number;
  rera: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: true });

  const labels = [
    { score: overall, label: "Overall", color: scoreColor(overall) },
    { score: amenity, label: "Amenity", color: scoreColor(amenity) },
    { score: rera, label: "RERA", color: scoreColor(rera) },
  ];

  return (
    <div ref={ref}>
      <div className="flex justify-center">
        <svg width={240} height={240} viewBox="0 0 240 240">
          <ScoreArc radius={100} score={overall} color={scoreColor(overall)} delay={0} inView={inView} />
          <ScoreArc radius={78} score={amenity} color={scoreColor(amenity)} delay={0.15} inView={inView} />
          <ScoreArc radius={56} score={rera} color={scoreColor(rera)} delay={0.3} inView={inView} />
        </svg>
      </div>
      <div className="mt-3 flex justify-center gap-6">
        {labels.map(({ label, color, score }, i) => (
          <motion.div
            key={label}
            className="flex flex-col items-center gap-1"
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ delay: 0.6 + i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="h-1 w-6 rounded-full"
              style={{ background: color, boxShadow: `0 0 6px ${color}60` }}
            />
            <span
              className="uppercase tracking-widest"
              style={{
                fontFamily: "var(--font-space-mono), monospace",
                fontSize: "8px",
                color: "#3a3a48",
              }}
            >
              {label}
            </span>
            <span
              className="tabular-nums"
              style={{
                fontFamily: "var(--font-syne), ui-sans-serif, sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                color,
              }}
            >
              {score.toFixed(0)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
