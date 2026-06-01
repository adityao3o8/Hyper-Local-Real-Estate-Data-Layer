"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { scoreColor } from "@/lib/api";
import type { ReportResponse } from "@/lib/types";
import { CountUpScore } from "./CountUpScore";
import { StatRow } from "./StatRow";
import { Sparkline } from "./Sparkline";
import { AnalysisPanel } from "./AnalysisPanel";
import { ExportButton } from "./ExportButton";

const LocalityMap = dynamic(
  () => import("./LocalityMap").then((m) => m.LocalityMap),
  { ssr: false, loading: () => <div className="no-print mt-12 h-[420px] border border-[#1A1A1A] bg-[#0F0F0F]" /> }
);

export function ResultsPanel({ data }: { data: ReportResponse }) {
  const color = scoreColor(data.neighbourhood_score);

  const stats: {
    label: string;
    display: string | number;
    seed?: string;
    sparkEnd?: number;
  }[] = [
    {
      label: "RERA score",
      display: data.rera_score.toFixed(1),
      seed: `${data.locality}-rera`,
      sparkEnd: data.rera_score,
    },
    {
      label: "Amenity score",
      display: data.amenity_score.toFixed(1),
      seed: `${data.locality}-amenity`,
      sparkEnd: data.amenity_score,
    },
    {
      label: "RERA projects matched",
      display: data.rera_projects_matched,
    },
    {
      label: "Avg complaints",
      display: data.avg_complaints ?? "—",
      seed: `${data.locality}-complaints`,
      sparkEnd: data.avg_complaints ?? 0,
    },
  ];

  return (
    <div id="report-print-area">
      <motion.section
        className="relative z-10 mx-auto w-full max-w-[1280px] bg-transparent px-6 pb-8 pt-4"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
      >
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[2fr_3fr] lg:gap-10">
          {/* Left column */}
          <div>
            <CountUpScore value={data.neighbourhood_score} color={color} />
            <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.2em] text-[#666666]">
              Neighbourhood Score
            </p>
            <Sparkline
              seed={`${data.locality}-overall`}
              endValue={data.neighbourhood_score}
              width={120}
              height={28}
            />
            <hr className="my-8 border-0 border-t border-[#1A1A1A]" />
            <div>
              {stats.map((stat, i) => (
                <div key={stat.label}>
                  <StatRow label={stat.label} value={stat.display} index={i} />
                  {stat.seed && stat.sparkEnd !== undefined && (
                    <div className="mb-2">
                      <Sparkline seed={stat.seed} endValue={stat.sparkEnd} width={72} height={20} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right column — full analysis panel */}
          <AnalysisPanel data={data} />
        </div>

        <LocalityMap data={data} />
      </motion.section>

      <ExportButton />
    </div>
  );
}
