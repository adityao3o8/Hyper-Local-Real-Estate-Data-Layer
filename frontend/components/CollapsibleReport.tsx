"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Reveal } from "./scroll/Reveal";

/** Split on sentence endings without breaking decimals like 71.5 or ₹1.2 Cr. */
function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Shield digit.digit sequences so "71.5" is not treated as a sentence end.
  const shielded = trimmed.replace(/(\d)\.(\d)/g, "$1\u0000$2");
  const parts = shielded.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  if (!parts) return [trimmed];

  return parts
    .map((s) => s.replace(/\u0000/g, ".").trim())
    .filter(Boolean);
}

export function CollapsibleReport({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  const { preview, hasMore } = useMemo(() => {
    const sentences = splitSentences(text);
    if (sentences.length <= 2) {
      return { preview: text.trim(), hasMore: false };
    }
    return {
      preview: sentences.slice(0, 2).join(" ").trim(),
      hasMore: true,
    };
  }, [text]);

  const display = open || !hasMore ? text.trim() : preview;

  return (
    <Reveal
      direction="up"
      distance={24}
      duration={0.7}
      amount={0.15}
      className="mt-6 border-t pt-6"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <motion.p
        key={open ? "full" : "preview"}
        className="leading-[1.85]"
        style={{ fontSize: "15px", color: "#c8c8d4", fontWeight: 400 }}
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        {display || "AI analysis unavailable for this locality."}
      </motion.p>

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
