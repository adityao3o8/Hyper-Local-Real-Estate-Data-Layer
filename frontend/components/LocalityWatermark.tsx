"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export function LocalityWatermark({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Word drifts left as user scrolls
  const x = useTransform(scrollYProgress, [0, 1], ["8%", "-22%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 0.05, 0.05, 0]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <motion.div
        className="absolute top-1/2 left-0 right-0 select-none whitespace-nowrap text-center"
        style={{
          x,
          opacity,
          fontFamily: "var(--font-syne), ui-sans-serif, sans-serif",
          fontSize: "clamp(120px, 22vw, 320px)",
          fontWeight: 800,
          lineHeight: 1,
          color: "#16C784",
          letterSpacing: "-0.05em",
          transform: "translateY(-50%)",
          mixBlendMode: "screen",
        }}
      >
        {name.toUpperCase()}
      </motion.div>
    </div>
  );
}
