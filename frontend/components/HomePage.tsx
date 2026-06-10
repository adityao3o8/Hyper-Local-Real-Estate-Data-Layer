"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchLocalities, fetchReportWithPrices } from "@/lib/api";
import { pickFamousLocalities } from "@/lib/localitySearch";
import type { LocalitySummary, ReportResponse } from "@/lib/types";
import { HeroBackground } from "./HeroBackground";
import { TopProgressBar } from "./TopProgressBar";
import { HomeBackButton } from "./home/HomeBackButton";
import { HomeSearchHeader } from "./home/HomeSearchHeader";
import { ScrollProgress } from "./scroll/ScrollProgress";

const ResultsPanel = dynamic(
  () => import("./ResultsPanel").then((m) => m.ResultsPanel),
  { ssr: false, loading: () => null }
);

const ComparePanel = dynamic(
  () => import("./ComparePanel").then((m) => m.ComparePanel),
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
      const data = await fetchReportWithPrices(trimmed);
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
      const data = await fetchReportWithPrices(trimmed);
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
    <div className="relative min-h-screen text-[#efefef]" style={{ background: "#070709" }}>
      <TopProgressBar active={loading || compareLoading} />
      {showResults && <ScrollProgress />}
      <HeroBackground />

      <AnimatePresence>
        {showResults && <HomeBackButton onClick={goHome} />}
      </AnimatePresence>

      <div className={`noise-layer z-[2] ${focused ? "visible" : ""}`} aria-hidden />

      <HomeSearchHeader
        query={query}
        onQueryChange={setQuery}
        onSearch={search}
        loading={loading}
        focused={focused}
        onFocusChange={setFocused}
        showResults={showResults}
        showCompare={showResults}
        onCompareClick={() => setCompareOpen(true)}
        famous={famous}
        catalog={catalog}
        error={error}
        inputRef={inputRef}
      />

      <AnimatePresence mode="wait">
        {showResults && result && (
          <motion.div
            key={result.locality}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <ResultsPanel data={result} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {compareOpen && result && (
          <>
            <motion.div
              className="no-print fixed inset-0 z-40 bg-black/70"
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
