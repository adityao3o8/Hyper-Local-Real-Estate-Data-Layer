"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchLocalities, fetchReport } from "@/lib/api";
import { pickFamousLocalities } from "@/lib/localitySearch";
import type { LocalitySummary, ReportResponse } from "@/lib/types";
import { ResultsPanel } from "./ResultsPanel";
import { TopProgressBar } from "./TopProgressBar";
import { ComparePanel } from "./ComparePanel";
import { LocalitySearch } from "./LocalitySearch";

const VantaHeroBackground = dynamic(
  () =>
    import("@/components/VantaHeroBackground").then((m) => m.VantaHeroBackground),
  { ssr: false, loading: () => null }
);

export function HomePage() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [compareResult, setCompareResult] = useState<ReportResponse | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [catalog, setCatalog] = useState<LocalitySummary[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchingRef = useRef(false);

  const famous = useMemo(() => pickFamousLocalities(catalog), [catalog]);

  useEffect(() => {
    fetchLocalities()
      .then((data) => {
        const scored = data.localities.filter((item) => !("error" in item));
        setCatalog(scored);
      })
      .catch(() => {});
  }, []);

  const search = useCallback(async (locality: string) => {
    const trimmed = locality.trim();
    if (!trimmed || searchingRef.current) return;

    searchingRef.current = true;
    if (typeof window !== "undefined" && !window.history.state?.localitySearch) {
      window.history.pushState({ localitySearch: true }, "");
    }
    setQuery(trimmed);
    setLoading(true);
    setError(null);
    setResult(null);
    setCompareResult(null);
    setHasSearched(true);

    try {
      const data = await fetchReport(trimmed);
      setResult(data);
      setError(null);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      searchingRef.current = false;
    }
  }, []);

  const runCompare = useCallback(async (locality: string) => {
    const trimmed = locality.trim();
    if (!trimmed) return;
    setCompareLoading(true);
    try {
      const data = await fetchReport(trimmed);
      setCompareResult(data);
    } catch {
      setCompareResult(null);
    } finally {
      setCompareLoading(false);
    }
  }, []);

  const goHome = useCallback(() => {
    setHasSearched(false);
    setResult(null);
    setCompareResult(null);
    setCompareOpen(false);
    setError(null);
    setQuery("");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    const onPopState = () => goHome();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [goHome]);

  const showResults = hasSearched && result !== null && !loading;

  return (
    <div className="relative min-h-screen bg-transparent text-[#F5F5F5]">
      <TopProgressBar active={loading || compareLoading} />
      <VantaHeroBackground layoutKey={showResults ? result?.locality : "hero"} />

      <AnimatePresence>
        {showResults && (
          <motion.button
            type="button"
            onClick={goHome}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="no-print fixed left-6 top-6 z-50 flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 text-[13px] font-medium text-[#E8E8E8] backdrop-blur-md transition-colors hover:border-[#16C784]/60 hover:bg-black/70 hover:text-white"
            aria-label="Back to home"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Home
          </motion.button>
        )}
      </AnimatePresence>
      <div
        className={`noise-layer z-[2] ${focused ? "visible" : ""}`}
        aria-hidden
      />

      <motion.header
        className="no-print relative z-30 flex flex-col items-center justify-center px-6 pointer-events-none"
        animate={{
          minHeight: showResults ? "auto" : "100vh",
          paddingTop: showResults ? "3rem" : "0",
          paddingBottom: showResults ? "1.5rem" : "0",
        }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
      >
        <div className="pointer-events-auto relative z-40 flex w-full flex-col items-center px-4">
          <LocalitySearch
            query={query}
            onQueryChange={setQuery}
            onSearch={search}
            loading={loading}
            focused={focused}
            onFocusChange={setFocused}
            showCompare={showResults}
            onCompareClick={() => setCompareOpen(true)}
            famous={famous}
            catalog={catalog}
            showFamousPicks={!showResults}
            compact={showResults}
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
      </motion.header>

      <AnimatePresence mode="wait">
        {showResults && result && (
          <motion.div
            key={result.locality}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ResultsPanel data={result} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {compareOpen && result && (
          <>
            <motion.div
              className="no-print fixed inset-0 z-40 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCompareOpen(false)}
            />
            <ComparePanel
              primary={result}
              compare={compareResult}
              onCompare={runCompare}
              onClose={() => setCompareOpen(false)}
              loading={compareLoading}
            />
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
