"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import type { AmenityBreakdown } from "@/lib/types";
import { StaggerReveal, StaggerItem } from "./scroll/Reveal";

const CARDS = [
  { key: "hospital" as const, label: "Hospitals", color: "#EF4444", blurb: "Healthcare access" },
  { key: "school" as const, label: "Schools", color: "#3B82F6", blurb: "Education" },
  { key: "park" as const, label: "Parks", color: "#16C784", blurb: "Green cover" },
  { key: "metro" as const, label: "Metro", color: "#F59E0B", blurb: "Connectivity" },
];

function CountUp({ value, color }: { value: number; color: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.6, once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 900, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, inView]);

  return (
    <span
      ref={ref}
      className="tabular-nums"
      style={{
        color,
        fontFamily: "var(--font-syne), ui-sans-serif, sans-serif",
        fontSize: "26px",
        fontWeight: 700,
        lineHeight: 1,
        display: "inline-block",
      }}
    >
      {display}
    </span>
  );
}

export function AmenityStatCards({ breakdown }: { breakdown: AmenityBreakdown }) {
  return (
    <StaggerReveal className="mt-6 grid grid-cols-2 gap-2.5" stagger={0.09} amount={0.2}>
      {CARDS.map((card) => (
        <StaggerItem key={card.key} direction="up" distance={20}>
          <motion.div
            className="group relative overflow-hidden rounded-xl p-4 transition-all duration-300"
            style={{
              border: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(255,255,255,0.02)",
            }}
            whileHover={{
              y: -2,
              borderColor: `${card.color}30`,
              backgroundColor: `${card.color}08`,
            }}
          >
            <div
              className="mb-3 h-1.5 w-1.5 rounded-full"
              style={{ background: card.color, boxShadow: `0 0 8px ${card.color}80` }}
            />
            <CountUp value={breakdown[card.key]} color={card.color} />
            <p
              className="mt-2 uppercase tracking-[0.14em]"
              style={{
                fontFamily: "var(--font-space-mono), monospace",
                fontSize: "9px",
                color: "#52525e",
              }}
            >
              {card.label}
            </p>
            <p
              className="mt-1 tracking-wide transition-colors group-hover:text-[#7a7a8a]"
              style={{ fontSize: "10px", color: "#3a3a48" }}
            >
              {card.blurb}
            </p>
          </motion.div>
        </StaggerItem>
      ))}
    </StaggerReveal>
  );
}
