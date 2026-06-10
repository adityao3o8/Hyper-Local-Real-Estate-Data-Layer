"use client";

import { motion } from "framer-motion";
import { formatInr, formatInrRange } from "@/lib/format";
import type { PropertyPricesSummary } from "@/lib/types";
import { Reveal } from "./scroll/Reveal";

export function PropertyPricesCard({ prices }: { prices: PropertyPricesSummary }) {
  if (prices.error) {
    return (
      <Reveal direction="up" distance={20} amount={0.3}>
        <div
          className="mt-5 rounded-xl p-4"
          style={{
            border: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <p
            className="uppercase tracking-[0.2em]"
            style={{
              fontFamily: "var(--font-space-mono), monospace",
              fontSize: "9px",
              color: "#3a3a48",
            }}
          >
            Market prices · MagicBricks
          </p>
          <p className="mt-2" style={{ fontSize: "12px", color: "#52525e" }}>
            Price data unavailable right now.
          </p>
        </div>
      </Reveal>
    );
  }

  const totals = prices.total_price_inr;
  const perSqft = prices.per_sqft_inr;
  const samples = (prices.price_mentions ?? [])
    .filter((p) => p.unit === "total" && p.amount_inr)
    .slice(0, 3);

  if (!totals && !perSqft && samples.length === 0) return null;

  return (
    <Reveal direction="up" distance={28} duration={0.7} amount={0.2}>
      <motion.div
        className="mt-5 rounded-xl p-5"
        style={{
          border: "1px solid rgba(22, 199, 132, 0.12)",
          background: "rgba(22, 199, 132, 0.03)",
        }}
        whileHover={{
          borderColor: "rgba(22, 199, 132, 0.28)",
          boxShadow: "0 0 32px -8px rgba(22, 199, 132, 0.25)",
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="uppercase tracking-[0.2em]"
              style={{
                fontFamily: "var(--font-space-mono), monospace",
                fontSize: "9px",
                color: "#3a3a48",
              }}
            >
              Market prices · MagicBricks
            </p>
            <p style={{ fontSize: "10px", color: "#2e2e3a", marginTop: "3px" }}>
              From listing snippets (indicative)
            </p>
          </div>
          <span
            className="shrink-0 rounded-md px-2 py-0.5"
            style={{
              border: "1px solid rgba(255,255,255,0.05)",
              fontFamily: "var(--font-space-mono), monospace",
              fontSize: "9px",
              color: "#3a3a48",
            }}
          >
            SerpAPI
          </span>
        </div>

        {totals && (
          <div className="mt-4">
            <p
              className="tabular-nums leading-none"
              style={{
                fontFamily: "var(--font-syne), ui-sans-serif, sans-serif",
                fontSize: "28px",
                fontWeight: 700,
                color: "#efefef",
              }}
            >
              {formatInr(totals.median)}
            </p>
            <p style={{ fontSize: "11px", color: "#52525e", marginTop: "4px" }}>
              median listing price
            </p>
            <p style={{ fontSize: "13px", color: "#16C784", marginTop: "8px", fontWeight: 500 }}>
              {formatInrRange(totals.min, totals.max)}
            </p>
            <p
              style={{
                fontFamily: "var(--font-space-mono), monospace",
                fontSize: "9px",
                color: "#3a3a48",
                marginTop: "3px",
              }}
            >
              {totals.sample_count} prices from search results
            </p>
          </div>
        )}

        {perSqft && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <p
              className="tabular-nums"
              style={{
                fontFamily: "var(--font-syne), ui-sans-serif, sans-serif",
                fontSize: "18px",
                fontWeight: 600,
                color: "#efefef",
              }}
            >
              {formatInr(perSqft.median)}
              <span
                style={{
                  fontFamily: "var(--font-space-mono), monospace",
                  fontSize: "11px",
                  fontWeight: 400,
                  color: "#52525e",
                  marginLeft: "6px",
                }}
              >
                / sq ft
              </span>
            </p>
            <p style={{ fontSize: "11px", color: "#52525e", marginTop: "3px" }}>
              {formatInrRange(perSqft.min, perSqft.max)} per sq ft
            </p>
          </div>
        )}

        {samples.length > 0 && (
          <ul
            className="mt-4 space-y-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "16px" }}
          >
            {samples.map((p, i) => (
              <motion.li
                key={`${p.raw}-${p.source_link}`}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
              >
                <a
                  href={p.source_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 transition-colors hover:text-[#16C784]"
                >
                  <span style={{ fontSize: "12px", color: "#efefef" }}>{p.raw}</span>
                  <span style={{ fontSize: "10px", color: "#2e2e3a" }}>·</span>
                  <span
                    className="line-clamp-1 group-hover:text-[#16C784]"
                    style={{ fontSize: "11px", color: "#52525e" }}
                  >
                    {p.source_title}
                  </span>
                </a>
              </motion.li>
            ))}
          </ul>
        )}
      </motion.div>
    </Reveal>
  );
}
