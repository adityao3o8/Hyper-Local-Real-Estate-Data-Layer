"use client";

import { motion } from "framer-motion";
import { investmentSignal } from "@/lib/api";
import { Reveal } from "./scroll/Reveal";

export function InvestmentBadge({ score }: { score: number }) {
  const { label, color } = investmentSignal(score);

  return (
    <Reveal direction="scale" duration={0.55} amount={0.5}>
      <div
        className="mt-5 flex items-center gap-3 rounded-xl px-4 py-3"
        style={{
          border: `1px solid ${color}22`,
          background: `${color}08`,
        }}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full"
            style={{ backgroundColor: color }}
            animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
        </span>
        <span
          className="uppercase tracking-[0.22em]"
          style={{
            fontFamily: "var(--font-space-mono), monospace",
            fontSize: "10px",
            color,
          }}
        >
          {label}
        </span>
        <span
          className="ml-auto uppercase tracking-[0.15em]"
          style={{
            fontFamily: "var(--font-space-mono), monospace",
            fontSize: "9px",
            color: "#2e2e3a",
          }}
        >
          Investment Signal
        </span>
      </div>
    </Reveal>
  );
}
