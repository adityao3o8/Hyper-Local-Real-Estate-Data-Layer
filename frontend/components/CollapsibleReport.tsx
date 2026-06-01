"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function CollapsibleReport({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  const { preview, rest } = useMemo(() => {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    if (sentences.length <= 2) {
      return { preview: text, rest: "" };
    }
    return {
      preview: sentences.slice(0, 2).join(" ").trim(),
      rest: sentences.slice(2).join(" ").trim(),
    };
  }, [text]);

  const hasMore = Boolean(rest);

  return (
    <div className="mt-6 border-t border-[#1A1A1A] pt-6">
      <p className="text-[18px] leading-[1.8] text-[#F5F5F5]">
        {open || !hasMore ? text : preview}
      </p>
      <AnimatePresence>
        {open && hasMore && (
          <motion.p
            className="mt-4 text-[18px] leading-[1.8] text-[#F5F5F5]"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {rest}
          </motion.p>
        )}
      </AnimatePresence>
      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-4 text-[12px] text-[#666666] transition-colors hover:text-[#F5F5F5]"
        >
          {open ? "Read less ↑" : "Read full analysis ↓"}
        </button>
      )}
      <p className="mt-8 text-[10px] uppercase tracking-[0.22em] text-[#666666]">
        RERA · OSM · AI ANALYSIS
      </p>
    </div>
  );
}
