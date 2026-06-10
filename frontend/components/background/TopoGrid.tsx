"use client";

import { motion, useScroll, useTransform } from "framer-motion";

export function TopoGrid() {
  const { scrollY } = useScroll();
  const rotateX = useTransform(scrollY, [0, 1500], [55, 35]);
  const translateY = useTransform(scrollY, [0, 1500], [0, -200]);
  const opacity = useTransform(scrollY, [0, 600, 1400], [0.55, 0.4, 0.15]);

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        opacity,
        perspective: "1200px",
        perspectiveOrigin: "50% 0%",
      }}
      aria-hidden
    >
      <motion.svg
        viewBox="0 0 2000 2000"
        preserveAspectRatio="xMidYMid slice"
        className="absolute left-1/2 top-1/2"
        style={{
          width: "200vw",
          height: "200vh",
          transformOrigin: "50% 50%",
          x: "-50%",
          y: translateY,
          rotateX,
        }}
      >
        <defs>
          <linearGradient id="topo-fade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#16C784" stopOpacity="0" />
            <stop offset="0.45" stopColor="#16C784" stopOpacity="0.45" />
            <stop offset="1" stopColor="#16C784" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="topo-fade-h" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#16C784" stopOpacity="0" />
            <stop offset="0.5" stopColor="#16C784" stopOpacity="0.32" />
            <stop offset="1" stopColor="#16C784" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {Array.from({ length: 22 }, (_, i) => {
          const y = i * 90;
          return (
            <motion.line
              key={`h-${i}`}
              x1="0"
              x2="2000"
              y1={y}
              y2={y}
              stroke="url(#topo-fade-h)"
              strokeWidth={i % 4 === 0 ? 0.8 : 0.4}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}

        {/* Vertical grid lines */}
        {Array.from({ length: 22 }, (_, i) => {
          const x = i * 90;
          return (
            <motion.line
              key={`v-${i}`}
              x1={x}
              x2={x}
              y1="0"
              y2="2000"
              stroke="url(#topo-fade)"
              strokeWidth={i % 4 === 0 ? 0.8 : 0.4}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.6, delay: 0.3 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}

        {/* Hot spots — accent dots at intersections */}
        {[
          [4, 6], [8, 11], [13, 7], [16, 14], [10, 17], [3, 13], [18, 4],
        ].map(([cx, cy], i) => (
          <motion.circle
            key={`dot-${i}`}
            cx={cx * 90}
            cy={cy * 90}
            r="3"
            fill="#16C784"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0.6], scale: [0, 1.4, 1] }}
            transition={{
              duration: 2.4,
              delay: 1 + i * 0.25,
              repeat: Infinity,
              repeatDelay: 3,
              ease: "easeInOut",
            }}
            style={{ filter: "drop-shadow(0 0 6px #16C784)" }}
          />
        ))}
      </motion.svg>
    </motion.div>
  );
}
