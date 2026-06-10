"use client";

import { motion } from "framer-motion";

export function HomeBackButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="no-print fixed left-5 top-4 z-50 flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-medium transition-all"
      style={{
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(7,7,9,0.7)",
        color: "#a8a8b8",
        backdropFilter: "blur(12px)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "#efefef";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(22,199,132,0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "#a8a8b8";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)";
      }}
      aria-label="Back to home"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
      Home
    </motion.button>
  );
}
