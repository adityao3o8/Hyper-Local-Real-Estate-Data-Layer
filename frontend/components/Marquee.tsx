"use client";

import { motion } from "framer-motion";

const ITEMS = [
  "INDIRANAGAR",
  "WHITEFIELD",
  "KORAMANGALA",
  "HSR LAYOUT",
  "JAYANAGAR",
  "ELECTRONIC CITY",
  "MARATHAHALLI",
  "HEBBAL",
  "YELAHANKA",
  "SARJAPUR ROAD",
  "BTM LAYOUT",
  "BANASHANKARI",
  "RAJAJINAGAR",
  "BELLANDUR",
  "MALLESHWARAM",
];

export function Marquee({
  speed = 38,
  reverse = false,
}: {
  speed?: number;
  reverse?: boolean;
}) {
  // Duplicate items so the loop is seamless
  const loop = [...ITEMS, ...ITEMS];

  return (
    <div
      className="no-print pointer-events-none relative overflow-hidden py-3"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(7,7,9,0.55)",
        backdropFilter: "blur(8px)",
        maskImage:
          "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
      }}
    >
      <motion.div
        className="flex shrink-0 gap-12 whitespace-nowrap"
        animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration: speed, ease: "linear", repeat: Infinity }}
      >
        {loop.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="flex items-center gap-12"
            style={{
              fontFamily: "var(--font-space-mono), monospace",
              fontSize: "13px",
              letterSpacing: "0.32em",
              color: "#4a4a58",
            }}
          >
            {item}
            <span
              className="inline-block h-1 w-1 rounded-full"
              style={{ background: "#16C784", boxShadow: "0 0 6px #16C784" }}
            />
          </span>
        ))}
      </motion.div>
    </div>
  );
}
