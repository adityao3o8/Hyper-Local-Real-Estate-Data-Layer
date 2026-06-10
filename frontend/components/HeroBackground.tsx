"use client";

import dynamic from "next/dynamic";
import { motion, useScroll, useTransform } from "framer-motion";

const ParticleField = dynamic(
  () => import("./background/ParticleField").then((m) => m.ParticleField),
  { ssr: false }
);

const TopoGrid = dynamic(
  () => import("./background/TopoGrid").then((m) => m.TopoGrid),
  { ssr: false }
);

export function HeroBackground() {
  const { scrollY } = useScroll();

  const y1 = useTransform(scrollY, [0, 1200], [0, -240]);
  const y2 = useTransform(scrollY, [0, 1200], [0, -140]);
  const y3 = useTransform(scrollY, [0, 1200], [0, -360]);
  const opacity = useTransform(scrollY, [0, 800], [1, 0.55]);

  return (
    <>
      {/* Static color base */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "#070709" }}
        aria-hidden
      />

      {/* Aurora glow orbs */}
      <motion.div
        className="hero-background pointer-events-none fixed inset-0 z-0"
        style={{ opacity }}
        aria-hidden
      >
        <motion.div className="orb orb-1" style={{ y: y1 }} />
        <motion.div className="orb orb-2" style={{ y: y2 }} />
        <motion.div className="orb orb-3" style={{ y: y3 }} />
      </motion.div>

      {/* Animated topographic grid mesh */}
      <TopoGrid />

      {/* Particle constellation — the main "art" */}
      <ParticleField />

      {/* Vignette to focus center */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 0%, transparent 50%, rgba(7,7,9,0.55) 100%)",
        }}
        aria-hidden
      />
    </>
  );
}
