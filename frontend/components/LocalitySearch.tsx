"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    <div className={`relative z-50 flex w-full flex-col items-center ${compact ? "max-w-[720px]" : "max-w-[760px]"}`}>
      {!compact && (
        <div className="mb-12 text-center">
          <h1 className="hero-text-shadow text-[48px] font-semibold leading-[1.03] tracking-tight text-white sm:text-[72px]">
            Neighbourhood Intelligence
          </h1>
          <p className="hero-text-shadow mt-4 text-[15px] font-medium uppercase tracking-[0.26em] text-[#9CA3AF] sm:text-[18px]">
            for Bangalore
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="relative w-full">
        <label htmlFor="locality-search" className="sr-only">
          Locality search
        </label>
        <div className="flex w-full items-center gap-2">
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
              className="hero-input h-16 w-full rounded-full border border-white/15 bg-black/40 px-7 text-[18px] text-[#F5F5F5] outline-none backdrop-blur-md transition-[border-color,box-shadow,background-color] placeholder:text-white/45 focus:border-[#16C784]/70 focus:bg-black/55 focus:shadow-[0_0_0_4px_rgba(22,199,132,0.18)] disabled:opacity-50"
              aria-label="Search Bangalore locality"
            />

            <AnimatePresence>
              {showDropdown && (
                <motion.ul
                  id="locality-typeahead"
                  role="listbox"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-[calc(100%+8px)] z-[60] overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]/90 py-1 shadow-2xl backdrop-blur-xl"
                >
                  {typeahead.map((item, index) => (
                    <li key={item.locality} role="option" aria-selected={index === activeIndex}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(item.locality)}
                        className={`w-full px-6 py-3 text-left text-[15px] ${
                          index === activeIndex
                            ? "bg-white/10 text-[#F5F5F5]"
                            : "text-[#D0D0D0] hover:bg-white/5"
                        }`}
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
            className="h-16 shrink-0 rounded-full bg-[#16C784] px-9 text-[16px] font-medium text-[#080808] transition-colors hover:bg-[#12A86F] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "…" : "Search"}
          </button>
        </div>

        {showCompare && onCompareClick && (
          <button
            type="button"
            onClick={onCompareClick}
            className="hero-text-shadow mt-3 text-[12px] text-[#B0B0B0] underline-offset-2 hover:text-white hover:underline"
          >
            Compare two localities
          </button>
        )}
      </form>

      {showFamousPicks && famous.length > 0 && (
        <div className="mt-8 flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-3">
            {famous.map((item) => (
              <button
                key={item.locality}
                type="button"
                onClick={() => pick(item.locality)}
                disabled={loading}
                className="rounded-full border border-white/15 bg-black/30 px-5 py-2.5 text-[14px] text-[#E8E8E8] backdrop-blur-md transition-colors hover:border-[#16C784]/60 hover:bg-black/45 hover:text-white disabled:opacity-40"
              >
                {item.locality}
              </button>
            ))}
          </div>
          <p className="hero-text-shadow mt-7 text-[13px] text-[#9A9A9A]">
            Or type any of 174+ neighbourhoods across Bangalore
          </p>
        </div>
      )}
    </div>
  );
}
