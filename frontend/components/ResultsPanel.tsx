"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { scoreColor } from "@/lib/api";
import type { ReportResponse } from "@/lib/types";
import { CountUpScore } from "./CountUpScore";
import { StatRow } from "./StatRow";
import { Sparkline } from "./Sparkline";
import { AnalysisPanel } from "./AnalysisPanel";
import { ExportButton } from "./ExportButton";
import { Reveal } from "./scroll/Reveal";
import { LocalityWatermark } from "./LocalityWatermark";
import { SectionRail } from "./SectionRail";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="no-print mt-16 h-[480px] overflow-hidden rounded-2xl border border-white/[0.06]">
      <div className="h-full w-full animate-pulse" style={{ background: "#0d0d10" }} />
    </div>
  ),
});

export function ResultsPanel({ data }: { data: ReportResponse }) {
  const color = scoreColor(data.neighbourhood_score);
  const scoreRef = useRef<HTMLDivElement>(null);

  // Dramatic scroll-driven scale + tilt on the giant score number
  const { scrollYProgress: scoreProgress } = useScroll({
    target: scoreRef,
    offset: ["start end", "end start"],
  });
  const scoreScale = useTransform(scoreProgress, [0, 0.3, 0.7, 1], [0.7, 1.05, 1, 0.85]);
  const scoreRotateZ = useTransform(scoreProgress, [0, 1], [-3, 3]);
  const scoreY = useTransform(scoreProgress, [0, 1], [60, -60]);

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
      <SectionRail />

      <motion.section
        className="relative z-10 mx-auto w-full max-w-[1320px] px-6 pb-16 pt-6"
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Giant locality watermark behind everything */}
        <div className="relative">
          <LocalityWatermark name={data.locality} />

          {/* Locality label */}
          <Reveal direction="up" distance={16} duration={0.5} amount={0.6} className="relative mb-8">
            <p
              className="uppercase tracking-[0.3em]"
              style={{
                fontFamily: "var(--font-space-mono), monospace",
                fontSize: "10px",
                color: "#3a3a48",
              }}
            >
              Report · {data.locality}
            </p>
          </Reveal>

          <div
            id="score-section"
            className="relative grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-10"
          >
            {/* Left column: score + stats — slides in from left */}
            <Reveal direction="right" distance={48} duration={0.8} amount={0.15}>
              <motion.div
                ref={scoreRef}
                style={{
                  scale: scoreScale,
                  rotateZ: scoreRotateZ,
                  y: scoreY,
                  transformOrigin: "left center",
                }}
              >
                <CountUpScore value={data.neighbourhood_score} color={color} />
              </motion.div>
              <p
                className="mt-3 uppercase tracking-[0.22em]"
                style={{
                  fontFamily: "var(--font-space-mono), monospace",
                  fontSize: "9px",
                  color: "#3a3a48",
                }}
              >
                Neighbourhood Score
              </p>
              <Sparkline
                seed={`${data.locality}-overall`}
                endValue={data.neighbourhood_score}
                width={120}
                height={28}
              />

              <div className="my-8 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

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
            </Reveal>

            {/* Right column: analysis — slides in from right */}
            <div id="analysis-section">
              <Reveal direction="left" distance={48} duration={0.8} amount={0.1}>
                <AnalysisPanel data={data} />
              </Reveal>
            </div>
          </div>
        </div>

        {/* Map — reveals from below */}
        <div id="map-section">
          <Reveal direction="up" distance={56} duration={0.9} amount={0.1}>
            <Map data={data} />
          </Reveal>
        </div>
      </motion.section>

      <ExportButton />
    </div>
  );
}
