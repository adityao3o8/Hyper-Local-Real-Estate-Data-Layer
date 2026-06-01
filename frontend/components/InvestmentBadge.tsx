"use client";

import { motion } from "framer-motion";
import { investmentSignal } from "@/lib/api";

export function InvestmentBadge({ score }: { score: number }) {
  const { label, color } = investmentSignal(score);

  return (
    <motion.div
      className="glass-panel mt-6 flex items-center gap-3 rounded px-4 py-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
    >
      <span className="relative flex h-2 w-2">
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: color }}
          animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </span>
      <span
        className="text-[12px] font-medium tracking-[0.25em]"
        style={{ fontFamily: "ui-monospace, monospace", color }}
      >
        {label}
      </span>
      <span className="ml-auto text-[10px] text-[#444444]">INVESTMENT SIGNAL</span>
    </motion.div>
  );
}
