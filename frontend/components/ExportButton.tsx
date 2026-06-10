"use client";

import { motion } from "framer-motion";

export function ExportButton() {
  return (
    <motion.button
      type="button"
      onClick={() => window.print()}
      className="no-print fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-xl px-5 py-2.5 text-[11px]"
      style={{
        fontFamily: "var(--font-space-mono), monospace",
        letterSpacing: "0.1em",
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(7,7,9,0.85)",
        color: "#52525e",
        backdropFilter: "blur(12px)",
      }}
      initial={{ opacity: 0, scale: 0.85, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{
        scale: 1.04,
        color: "#efefef",
        borderColor: "rgba(22,199,132,0.4)",
        boxShadow: "0 0 24px -8px rgba(22,199,132,0.4)",
      }}
      whileTap={{ scale: 0.96 }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
      Download Report
    </motion.button>
  );
}
