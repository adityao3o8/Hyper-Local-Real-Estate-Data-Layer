"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Reveal } from "./scroll/Reveal";

export function CollapsibleReport({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  const { preview, rest } = useMemo(() => {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    if (sentences.length <= 2) return { preview: text, rest: "" };
    return {
      preview: sentences.slice(0, 2).join(" ").trim(),
      rest: sentences.slice(2).join(" ").trim(),
    };
  }, [text]);

  const hasMore = Boolean(rest);

  return (
    <Reveal
      direction="up"
      distance={24}
      duration={0.7}
      amount={0.15}
      className="mt-6 border-t pt-6"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <p className="leading-[1.85]" style={{ fontSize: "15px", color: "#c8c8d4", fontWeight: 400 }}>
        {open || !hasMore ? text : preview}
      </p>

      <AnimatePresence>
        {open && hasMore && (
          <motion.p
            className="mt-4 leading-[1.85]"
            style={{ fontSize: "15px", color: "#c8c8d4" }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {rest}
          </motion.p>
        )}
      </AnimatePresence>

      {hasMore && (
        <motion.button
          type="button"
          onClick={() => setOpen(!open)}
          whileHover={{ x: 4 }}
          className="mt-5 transition-colors hover:text-[#efefef]"
          style={{
            fontFamily: "var(--font-space-mono), monospace",
            fontSize: "10px",
            letterSpacing: "0.15em",
            color: "#3a3a48",
            textTransform: "uppercase",
          }}
        >
          {open ? "Collapse ↑" : "Read full analysis ↓"}
        </motion.button>
      )}

      <p
        className="mt-8 uppercase tracking-[0.28em]"
        style={{
          fontFamily: "var(--font-space-mono), monospace",
          fontSize: "9px",
          color: "#2e2e3a",
        }}
      >
        RERA · OSM · AI Analysis
      </p>
    </Reveal>
  );
}
