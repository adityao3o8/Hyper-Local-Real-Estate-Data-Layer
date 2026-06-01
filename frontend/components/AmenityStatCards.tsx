"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { AmenityBreakdown } from "@/lib/types";

const CARDS = [
  {
    key: "hospital" as const,
    icon: "🏥",
    label: "Hospitals",
    blurb: "World class healthcare access",
  },
  {
    key: "school" as const,
    icon: "🏫",
    label: "Schools",
    blurb: "Top rated educational institutes",
  },
  {
    key: "park" as const,
    icon: "🌳",
    label: "Parks",
    blurb: "Green cover & recreational spaces",
  },
  {
    key: "metro" as const,
    icon: "🚇",
    label: "Metro",
    blurb: "Direct metro connectivity",
  },
];

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 1000, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className="tabular-nums">{display}</span>;
}

export function AmenityStatCards({ breakdown }: { breakdown: AmenityBreakdown }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3">
      {CARDS.map((card, i) => (
        <motion.div
          key={card.key}
          className="glass-panel group rounded-lg p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#16C78466] hover:shadow-[0_0_24px_-4px_rgba(22,199,132,0.25)]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.08, duration: 0.4 }}
        >
          <div className="mb-2 text-lg">{card.icon}</div>
          <p className="text-[22px] font-medium text-[#F5F5F5]">
            <CountUp value={breakdown[card.key]} />
          </p>
          <p className="mt-1 text-[11px] text-[#666666]">{card.label}</p>
          <p className="mt-2 text-[10px] leading-snug text-[#444444] group-hover:text-[#666666]">
            {card.blurb}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
