"use client";

import { motion, useInView, type MotionProps, type Variants } from "framer-motion";
import { useRef, type CSSProperties, type ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right" | "scale" | "fade";

type RevealProps = {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  distance?: number;
  amount?: number;
  once?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "article" | "li" | "ul";
} & Omit<MotionProps, "initial" | "animate" | "variants" | "transition">;

function makeVariants(direction: Direction, distance: number): Variants {
  const base = { opacity: 0 };
  switch (direction) {
    case "up":
      return { hidden: { ...base, y: distance }, visible: { opacity: 1, y: 0 } };
    case "down":
      return { hidden: { ...base, y: -distance }, visible: { opacity: 1, y: 0 } };
    case "left":
      return { hidden: { ...base, x: distance }, visible: { opacity: 1, x: 0 } };
    case "right":
      return { hidden: { ...base, x: -distance }, visible: { opacity: 1, x: 0 } };
    case "scale":
      return { hidden: { ...base, scale: 0.94 }, visible: { opacity: 1, scale: 1 } };
    case "fade":
    default:
      return { hidden: base, visible: { opacity: 1 } };
  }
}

export function Reveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.6,
  distance = 32,
  amount = 0.25,
  once = true,
  className,
  style,
  as = "div",
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount, once, margin: "0px 0px -10% 0px" });
  const variants = makeVariants(direction, distance);
  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      ref={ref}
      className={className}
      style={style}
      variants={variants}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

type StaggerRevealProps = {
  children: ReactNode;
  delay?: number;
  stagger?: number;
  amount?: number;
  className?: string;
  style?: CSSProperties;
};

export function StaggerReveal({
  children,
  delay = 0,
  stagger = 0.08,
  amount = 0.2,
  className,
  style,
}: StaggerRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount, once: true, margin: "0px 0px -10% 0px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  direction = "up",
  distance = 24,
  duration = 0.55,
  className,
  style,
}: {
  children: ReactNode;
  direction?: Direction;
  distance?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const variants = makeVariants(direction, distance);
  return (
    <motion.div
      className={className}
      style={style}
      variants={variants}
      transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
