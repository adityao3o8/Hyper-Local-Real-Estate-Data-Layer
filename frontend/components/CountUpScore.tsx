"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

export function CountUpScore({
  value,
  duration = 1.4,
  color,
}: {
  value: number;
  duration?: number;
  color: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - t, 4);
      setDisplay(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, inView]);

  return (
    <span
      ref={ref}
      className="tabular-nums"
      style={{
        color,
        fontSize: "120px",
        lineHeight: 1,
        fontWeight: 700,
        fontFamily: "var(--font-syne), ui-sans-serif, sans-serif",
        letterSpacing: "-0.05em",
        display: "inline-block",
      }}
    >
      {display.toFixed(1)}
    </span>
  );
}
