"use client";

import { motion } from "framer-motion";
import { scoreColor } from "@/lib/api";

function ScoreArc({
  radius,
  score,
  color,
  delay,
}: {
  radius: number;
  score: number;
  color: string;
  delay: number;
}) {
  const cx = 110;
  const cy = 110;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (score / 100) * circumference;

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="#1A1A1A"
        strokeWidth={9}
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={circumference}
        transform={`rotate(-90 ${cx} ${cy})`}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: targetOffset }}
        transition={{ duration: 1.2, delay, ease: [0.22, 1, 0.36, 1] }}
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
  return (
    <div>
      <div className="flex justify-center">
        <svg width={220} height={220} viewBox="0 0 220 220">
          <ScoreArc radius={88} score={overall} color={scoreColor(overall)} delay={0} />
          <ScoreArc radius={68} score={amenity} color={scoreColor(amenity)} delay={0.15} />
          <ScoreArc radius={48} score={rera} color={scoreColor(rera)} delay={0.3} />
        </svg>
      </div>
      <div className="mt-2 flex justify-center gap-6 text-[9px] uppercase tracking-widest text-[#666666]">
        <span>Overall</span>
        <span>Amenity</span>
        <span>RERA</span>
      </div>
    </div>
  );
}
