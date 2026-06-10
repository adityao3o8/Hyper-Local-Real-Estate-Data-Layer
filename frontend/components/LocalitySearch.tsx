"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { filterTypeahead } from "@/lib/localitySearch";
import type { LocalitySummary } from "@/lib/types";

type LocalitySearchProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: (locality: string) => void;
  loading: boolean;
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
  showCompare?: boolean;
  onCompareClick?: () => void;
  famous: LocalitySummary[];
  catalog: LocalitySummary[];
  showFamousPicks?: boolean;
  compact?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

export function LocalitySearch({
  query,
  onQueryChange,
  onSearch,
  loading,
  focused,
  onFocusChange,
  showCompare,
  onCompareClick,
  famous,
  catalog,
  showFamousPicks = true,
  compact = false,
  inputRef: externalRef,
}: LocalitySearchProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? internalRef;
  const [activeIndex, setActiveIndex] = useState(-1);

  // Hero parallax — heading moves slower than scroll, accent slides + fades.
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -120]);
  const heroOpacity = useTransform(scrollY, [0, 320], [1, 0]);
  const taglineY = useTransform(scrollY, [0, 600], [0, -60]);

  const typeahead = useMemo(
    () => (query.trim() ? filterTypeahead(catalog, query) : []),
    [catalog, query]
  );

  const showDropdown = focused && !loading && query.trim().length > 0 && typeahead.length > 0;

  const pick = (locality: string) => {
    onQueryChange(locality);
    onSearch(locality);
    inputRef.current?.blur();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (activeIndex >= 0 && typeahead[activeIndex]) {
      pick(typeahead[activeIndex].locality);
      return;
    }
    onSearch(query);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || typeahead.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, typeahead.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setActiveIndex(-1);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pick(typeahead[activeIndex].locality);
    }
  };

  return (
    <div className={`relative z-50 flex w-full flex-col items-center ${compact ? "max-w-[720px]" : "max-w-[800px]"}`}>
      {!compact && (
        <motion.div
          className="mb-14 text-center select-none"
          style={{ y: heroY, opacity: heroOpacity }}
        >
          <motion.h1
            className="hero-text-shadow leading-[0.95] tracking-tight text-white"
            style={{
              fontFamily: "var(--font-syne), ui-sans-serif, sans-serif",
              fontSize: "clamp(48px, 9vw, 96px)",
              fontWeight: 700,
            }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            Neighbourhood
            <br />
            <span style={{ color: "#16c784" }}>Intelligence</span>
          </motion.h1>
          <motion.p
            className="hero-text-shadow mt-5 uppercase"
            style={{
              fontFamily: "var(--font-space-mono), monospace",
              fontSize: "11px",
              letterSpacing: "0.35em",
              color: "#4a4a58",
              y: taglineY,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Bangalore · RERA · OSM · AI Analysis
          </motion.p>
        </motion.div>
      )}

      <form onSubmit={onSubmit} className="relative w-full">
        <label htmlFor="locality-search" className="sr-only">
          Locality search
        </label>
        <div className="flex w-full items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <input
              id="locality-search"
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={showDropdown}
              aria-controls="locality-typeahead"
              value={query}
              onChange={(e) => {
                onQueryChange(e.target.value);
                setActiveIndex(-1);
              }}
              onFocus={() => onFocusChange(true)}
              onBlur={() => {
                window.setTimeout(() => onFocusChange(false), 150);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search a locality…"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
              className="hero-input w-full rounded-full border border-white/10 bg-white/[0.04] px-7 text-[#efefef] outline-none backdrop-blur-md transition-all placeholder:text-white/30 focus:border-[#16C784]/50 focus:bg-white/[0.06] disabled:opacity-50"
              style={{
                height: compact ? "44px" : "64px",
                fontSize: compact ? "15px" : "18px",
              }}
              aria-label="Search Bangalore locality"
            />

            <AnimatePresence>
              {showDropdown && (
                <motion.ul
                  id="locality-typeahead"
                  role="listbox"
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-[calc(100%+10px)] z-[60] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0a0a0d]/95 py-1 shadow-2xl backdrop-blur-xl"
                >
                  {typeahead.map((item, index) => (
                    <li key={item.locality} role="option" aria-selected={index === activeIndex}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(item.locality)}
                        className={`w-full px-6 py-3 text-left transition-colors ${
                          index === activeIndex
                            ? "bg-white/[0.08] text-[#efefef]"
                            : "text-[#a8a8b8] hover:bg-white/[0.04] hover:text-[#efefef]"
                        }`}
                        style={{ fontSize: compact ? "14px" : "15px" }}
                      >
                        {item.locality}
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="shrink-0 rounded-full bg-[#16C784] font-medium text-[#070709] transition-all hover:bg-[#13b876] hover:shadow-[0_0_24px_-4px_rgba(22,199,132,0.5)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              height: compact ? "44px" : "64px",
              padding: compact ? "0 24px" : "0 36px",
              fontSize: compact ? "14px" : "16px",
            }}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg
                  className="animate-spin"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                {!compact && "Analysing"}
              </span>
            ) : (
              "Search"
            )}
          </button>
        </div>

        {showCompare && onCompareClick && (
          <motion.button
            type="button"
            onClick={onCompareClick}
            className="link-underline hero-text-shadow mt-3 text-[12px] text-[#52525e] transition-colors hover:text-[#efefef]"
            style={{ fontFamily: "var(--font-space-mono), monospace" }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ x: 4 }}
          >
            Compare two localities →
          </motion.button>
        )}
      </form>

      {showFamousPicks && famous.length > 0 && (
        <motion.div
          className="mt-10 flex flex-col items-center"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.045, delayChildren: 0.35 } },
          }}
        >
          <div className="flex flex-wrap justify-center gap-2.5">
            {famous.map((item) => (
              <motion.button
                key={item.locality}
                type="button"
                onClick={() => pick(item.locality)}
                disabled={loading}
                variants={{
                  hidden: { opacity: 0, y: 10, scale: 0.94 },
                  visible: { opacity: 1, y: 0, scale: 1 },
                }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -2, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="rounded-full border border-white/[0.09] bg-white/[0.03] px-5 py-2 text-[13px] text-[#a8a8b8] backdrop-blur-md transition-colors hover:border-[#16C784]/40 hover:bg-[#16C784]/[0.06] hover:text-[#efefef] disabled:opacity-40"
              >
                {item.locality}
              </motion.button>
            ))}
          </div>
          <motion.p
            className="hero-text-shadow mt-7 text-[11px] tracking-[0.12em]"
            style={{ color: "#3a3a48", fontFamily: "var(--font-space-mono), monospace" }}
            variants={{
              hidden: { opacity: 0, y: 6 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.4 }}
          >
            174+ neighbourhoods across Bangalore
          </motion.p>
        </motion.div>
      )}
    </div>
  );
}
