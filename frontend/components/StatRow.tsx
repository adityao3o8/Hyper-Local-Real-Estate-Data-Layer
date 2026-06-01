"use client";

import { motion } from "framer-motion";

export function StatRow({
  label,
  value,
  index,
}: {
  label: string;
  value: string | number;
  index: number;
}) {
  return (
    <motion.div
      className="stat-row group relative py-4"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-baseline justify-between gap-6">
        <span className="text-[13px] text-[#666666]">{label}</span>
        <span className="text-[15px] tabular-nums text-[#F5F5F5]">{value}</span>
      </div>
      <div className="stat-underline mt-3 h-px w-full overflow-hidden bg-[#1A1A1A]">
        <div className="h-full w-full bg-[#333333]" />
      </div>
    </motion.div>
  );
}
