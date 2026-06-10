"use client";

import dynamic from "next/dynamic";
import type { ReportResponse } from "@/lib/types";
import { ScoreRadialChart } from "./ScoreRadialChart";
import { AmenityStatCards } from "./AmenityStatCards";
import { InvestmentBadge } from "./InvestmentBadge";
import { CollapsibleReport } from "./CollapsibleReport";

const PropertyPricesCard = dynamic(
  () => import("./PropertyPricesCard").then((m) => m.PropertyPricesCard),
  { ssr: false, loading: () => null }
);

export function AnalysisPanel({ data }: { data: ReportResponse }) {
  return (
    <div
      className="rounded-2xl p-7 lg:p-9"
      style={{
        border: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(13, 13, 16, 0.72)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        boxShadow: "0 0 60px -20px rgba(22, 199, 132, 0.06)",
      }}
    >
      <p
        className="mb-7 uppercase tracking-[0.25em]"
        style={{
          fontFamily: "var(--font-space-mono), monospace",
          fontSize: "9px",
          color: "#3a3a48",
        }}
      >
        {data.locality} · Analysis
      </p>
      <ScoreRadialChart
        overall={data.neighbourhood_score}
        amenity={data.amenity_score}
        rera={data.rera_score}
      />
      <AmenityStatCards breakdown={data.amenity_breakdown} />
      {data.property_prices && <PropertyPricesCard prices={data.property_prices} />}
      <InvestmentBadge score={data.neighbourhood_score} />
      <CollapsibleReport text={data.ai_report} />
    </div>
  );
}
