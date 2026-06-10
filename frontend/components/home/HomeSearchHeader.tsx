"use client";

import type { RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LocalitySummary } from "@/lib/types";
import { LocalitySearch } from "@/components/LocalitySearch";
import { Marquee } from "@/components/Marquee";

type HomeSearchHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: (locality: string) => void;
  loading: boolean;
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
  showResults: boolean;
  showCompare: boolean;
  onCompareClick: () => void;
  famous: LocalitySummary[];
  catalog: LocalitySummary[];
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
};

export function HomeSearchHeader({
  query,
  onQueryChange,
  onSearch,
  loading,
  focused,
  onFocusChange,
  showResults,
  showCompare,
  onCompareClick,
  famous,
  catalog,
  error,
  inputRef,
}: HomeSearchHeaderProps) {
  return (
    <>
      {/* Hero state: fixed full-screen, GPU-accelerated opacity/transform only */}
      <AnimatePresence>
        {!showResults && (
          <motion.div
            key="hero-header"
            className="no-print fixed inset-0 z-30 flex items-center justify-center px-4 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pointer-events-auto relative z-40 w-full flex flex-col items-center">
              <LocalitySearch
                query={query}
                onQueryChange={onQueryChange}
                onSearch={onSearch}
                loading={loading}
                focused={focused}
                onFocusChange={onFocusChange}
                showCompare={false}
                onCompareClick={onCompareClick}
                famous={famous}
                catalog={catalog}
                showFamousPicks
                compact={false}
                inputRef={inputRef}
              />

              <AnimatePresence mode="wait">
                {error && !loading && (
                  <motion.p
                    key="error"
                    className="mt-6 max-w-md text-center text-[13px] leading-relaxed text-[#EF4444]"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Scrolling marquee strip at the bottom */}
            <motion.div
              className="pointer-events-none absolute bottom-12 left-0 right-0"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Marquee />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact sticky header: only opacity/transform animations */}
      <AnimatePresence>
        {showResults && (
          <motion.header
            key="compact-header"
            className="no-print sticky top-0 z-30 flex justify-center px-6 py-3"
            style={{
              background: "rgba(7, 7, 9, 0.88)",
              backdropFilter: "blur(20px) saturate(1.4)",
              WebkitBackdropFilter: "blur(20px) saturate(1.4)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="w-full max-w-[720px]">
              <LocalitySearch
                query={query}
                onQueryChange={onQueryChange}
                onSearch={onSearch}
                loading={loading}
                focused={focused}
                onFocusChange={onFocusChange}
                showCompare={showCompare}
                onCompareClick={onCompareClick}
                famous={famous}
                catalog={catalog}
                showFamousPicks={false}
                compact
                inputRef={inputRef}
              />
            </div>
          </motion.header>
        )}
      </AnimatePresence>
    </>
  );
}
