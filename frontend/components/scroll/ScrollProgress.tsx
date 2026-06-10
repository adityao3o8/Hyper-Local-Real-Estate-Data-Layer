"use client";

import { motion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 28,
    mass: 0.4,
  });

  return (
    <motion.div
      className="no-print fixed left-0 right-0 top-0 z-[90] h-[2px] origin-left"
      style={{
        scaleX,
        background:
          "linear-gradient(90deg, rgba(22,199,132,0.6) 0%, #16C784 50%, rgba(22,199,132,0.6) 100%)",
        boxShadow: "0 0 14px rgba(22,199,132,0.6)",
        transformOrigin: "0% 50%",
      }}
      aria-hidden
    />
  );
}
