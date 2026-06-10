"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Section = { id: string; label: string };

const SECTIONS: Section[] = [
  { id: "score-section", label: "SCORE" },
  { id: "analysis-section", label: "ANALYSIS" },
  { id: "map-section", label: "MAP" },
];

export function SectionRail() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { threshold: [0.2, 0.5, 0.8] }
    );

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="no-print pointer-events-none fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-5 lg:flex"
      aria-hidden
    >
      {SECTIONS.map((s) => {
        const isActive = active === s.id;
        return (
          <div key={s.id} className="flex items-center gap-3">
            <div className="relative h-px w-10 overflow-hidden bg-white/[0.06]">
              <motion.div
                className="absolute inset-y-0 left-0"
                style={{ background: "#16C784", boxShadow: "0 0 6px #16C784" }}
                initial={false}
                animate={{ width: isActive ? "100%" : "20%" }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <AnimatePresence mode="wait">
              <motion.span
                key={isActive ? "on" : "off"}
                className="uppercase tracking-[0.25em]"
                style={{
                  fontFamily: "var(--font-space-mono), monospace",
                  fontSize: "9px",
                  color: isActive ? "#16C784" : "#3a3a48",
                }}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {s.label}
              </motion.span>
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
