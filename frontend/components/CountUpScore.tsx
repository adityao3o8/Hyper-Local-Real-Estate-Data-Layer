"use client";

import { useEffect, useState } from "react";

export function CountUpScore({
  value,
  duration = 1.2,
  color,
}: {
  value: number;
  duration?: number;
  color: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span
      className="tabular-nums tracking-[-0.04em]"
      style={{ color, fontSize: "128px", lineHeight: 1, fontWeight: 500 }}
    >
      {display.toFixed(1)}
    </span>
  );
}
