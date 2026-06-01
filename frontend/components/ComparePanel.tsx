"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { scoreColor } from "@/lib/api";
import type { ReportResponse } from "@/lib/types";

function Delta({
  primary,
  compare,
  compareName,
}: {
  primary: number;
  compare: number;
  compareName: string;
}) {
  const diff = primary - compare;
  const better = diff > 0;
  const color = better ? "#16C784" : diff < 0 ? "#EF4444" : "#666666";
  const arrow = better ? "↑" : diff < 0 ? "↓" : "→";
  const qualifier = better ? "better" : diff < 0 ? "worse" : "same as";
  return (
    <span className="text-[11px] tabular-nums" style={{ color, fontFamily: "ui-monospace, monospace" }}>
      {diff > 0 ? "+" : ""}
      {diff.toFixed(1)} {qualifier} than {compareName} {arrow}
    </span>
  );
}

export function ComparePanel({
  primary,
  compare,
  onCompare,
  onClose,
  loading,
}: {
  primary: ReportResponse;
  compare: ReportResponse | null;
  onCompare: (locality: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    onCompare(query);
  };

  return (
    <motion.aside
      className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[#1A1A1A] bg-[#080808] p-6 shadow-2xl"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#666666]">
          Compare localities
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-[20px] leading-none text-[#666666] hover:text-[#F5F5F5]"
          aria-label="Close compare"
        >
          ×
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Second locality…"
          className="flex-1 border border-[#1A1A1A] bg-[#0F0F0F] px-3 py-2 text-[14px] text-[#F5F5F5] outline-none focus:border-[#333333]"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="border border-[#1A1A1A] bg-[#0F0F0F] px-4 py-2 text-[12px] text-[#F5F5F5] disabled:opacity-40"
        >
          Go
        </button>
      </form>

      {compare && (
        <div className="mt-8 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#666666]">
                {primary.locality}
              </p>
              <p
                className="mt-2 text-[48px] tabular-nums leading-none"
                style={{ color: scoreColor(primary.neighbourhood_score) }}
              >
                {primary.neighbourhood_score.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#666666]">
                {compare.locality}
              </p>
              <p
                className="mt-2 text-[48px] tabular-nums leading-none"
                style={{ color: scoreColor(compare.neighbourhood_score) }}
              >
                {compare.neighbourhood_score.toFixed(1)}
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t border-[#1A1A1A] pt-4 text-[13px]">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-[#666666]">Overall</span>
              <Delta
                primary={primary.neighbourhood_score}
                compare={compare.neighbourhood_score}
                compareName={compare.locality}
              />
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-[#666666]">RERA</span>
              <Delta
                primary={primary.rera_score}
                compare={compare.rera_score}
                compareName={compare.locality}
              />
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-[#666666]">Amenity</span>
              <Delta
                primary={primary.amenity_score}
                compare={compare.amenity_score}
                compareName={compare.locality}
              />
            </div>
          </div>

          <p className="text-[12px] leading-relaxed text-[#666666]">
            {primary.neighbourhood_score > compare.neighbourhood_score
              ? `${primary.locality} scores higher than ${compare.locality} on our composite index.`
              : `${compare.locality} outperforms ${primary.locality} on the composite index.`}
          </p>
        </div>
      )}
    </motion.aside>
  );
}
