"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export function StatRow({
  label,
  value,
  index,
}: {
  label: string;
  value: string | number;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: true });

  return (
    <motion.div
      ref={ref}
      className="stat-row group relative py-4"
      initial={{ opacity: 0, x: -16 }}
      animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
      transition={{ delay: index * 0.07, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-baseline justify-between gap-6">
        <span
          className="uppercase tracking-[0.12em]"
          style={{
            fontFamily: "var(--font-space-mono), monospace",
            fontSize: "10px",
            color: "#52525e",
          }}
        >
          {label}
        </span>
        <span
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-syne), ui-sans-serif, sans-serif",
            fontSize: "16px",
            fontWeight: 600,
            color: "#efefef",
          }}
        >
          {value}
        </span>
      </div>
      <div
        className="stat-underline mt-3 h-px w-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        <motion.div
          className="h-full"
          style={{ background: "rgba(22, 199, 132, 0.45)", originX: 0 }}
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ delay: index * 0.07 + 0.25, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </motion.div>
  );
}
