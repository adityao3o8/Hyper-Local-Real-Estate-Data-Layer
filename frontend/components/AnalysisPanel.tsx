"use client";

import type { ReportResponse } from "@/lib/types";
import { ScoreRadialChart } from "./ScoreRadialChart";
import { AmenityStatCards } from "./AmenityStatCards";
import { InvestmentBadge } from "./InvestmentBadge";
import { CollapsibleReport } from "./CollapsibleReport";

export function AnalysisPanel({ data }: { data: ReportResponse }) {
  return (
    <div className="glass-panel p-6 lg:p-8">
      <p className="mb-6 text-[11px] uppercase tracking-[0.18em] text-[#666666]">
        {data.locality} · Analysis
      </p>
      <ScoreRadialChart
        overall={data.neighbourhood_score}
        amenity={data.amenity_score}
        rera={data.rera_score}
      />
      <AmenityStatCards breakdown={data.amenity_breakdown} />
      <InvestmentBadge score={data.neighbourhood_score} />
      <CollapsibleReport text={data.ai_report} />
    </div>
  );
}
