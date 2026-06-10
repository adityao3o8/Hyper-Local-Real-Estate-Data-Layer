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
  const color = better ? "#16C784" : diff < 0 ? "#EF4444" : "#52525e";
  const arrow = better ? "↑" : diff < 0 ? "↓" : "→";
  const qualifier = better ? "better" : diff < 0 ? "worse" : "same as";

  return (
    <span
      className="tabular-nums"
      style={{
        color,
        fontFamily: "var(--font-space-mono), monospace",
        fontSize: "11px",
      }}
    >
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
      className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col p-7 shadow-2xl"
      style={{
        border: "none",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(7, 7, 9, 0.97)",
        backdropFilter: "blur(24px)",
      }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 120, damping: 24 }}
    >
      <div className="flex items-center justify-between">
        <p
          className="uppercase tracking-[0.25em]"
          style={{
            fontFamily: "var(--font-space-mono), monospace",
            fontSize: "9px",
            color: "#3a3a48",
          }}
        >
          Compare localities
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06]"
          style={{ color: "#52525e" }}
          aria-label="Close compare"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Second locality…"
          className="flex-1 rounded-xl px-4 py-2.5 text-[14px] text-[#efefef] outline-none transition-colors"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
          }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(22,199,132,0.4)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-xl px-5 py-2.5 text-[13px] font-medium transition-all hover:bg-[#13b876] disabled:opacity-40"
          style={{ background: "#16C784", color: "#070709" }}
        >
          {loading ? "…" : "Go"}
        </button>
      </form>

      {compare && (
        <div className="mt-8 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {[
              { data: primary, label: "Primary" },
              { data: compare, label: "Compare" },
            ].map(({ data, label }) => (
              <div key={data.locality}>
                <p
                  className="uppercase tracking-[0.18em]"
                  style={{
                    fontFamily: "var(--font-space-mono), monospace",
                    fontSize: "9px",
                    color: "#3a3a48",
                  }}
                >
                  {data.locality}
                </p>
                <p
                  className="mt-2 tabular-nums leading-none"
                  style={{
                    fontFamily: "var(--font-syne), ui-sans-serif, sans-serif",
                    fontSize: "48px",
                    fontWeight: 700,
                    color: scoreColor(data.neighbourhood_score),
                  }}
                >
                  {data.neighbourhood_score.toFixed(1)}
                </p>
              </div>
            ))}
          </div>

          <div
            className="space-y-3 pt-5"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            {[
              { label: "Overall", pv: primary.neighbourhood_score, cv: compare.neighbourhood_score },
              { label: "RERA", pv: primary.rera_score, cv: compare.rera_score },
              { label: "Amenity", pv: primary.amenity_score, cv: compare.amenity_score },
            ].map(({ label, pv, cv }) => (
              <div key={label} className="flex items-start justify-between gap-3">
                <span
                  className="uppercase tracking-[0.12em]"
                  style={{
                    fontFamily: "var(--font-space-mono), monospace",
                    fontSize: "9px",
                    color: "#3a3a48",
                    paddingTop: "2px",
                  }}
                >
                  {label}
                </span>
                <Delta primary={pv} compare={cv} compareName={compare.locality} />
              </div>
            ))}
          </div>

          <p style={{ fontSize: "13px", lineHeight: "1.7", color: "#52525e" }}>
            {primary.neighbourhood_score > compare.neighbourhood_score
              ? `${primary.locality} scores higher than ${compare.locality} on our composite index.`
              : `${compare.locality} outperforms ${primary.locality} on the composite index.`}
          </p>
        </div>
      )}
    </motion.aside>
  );
}
