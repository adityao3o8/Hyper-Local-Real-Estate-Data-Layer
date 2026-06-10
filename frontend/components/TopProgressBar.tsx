"use client";

import { motion, AnimatePresence } from "framer-motion";

export function TopProgressBar({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed left-0 right-0 top-0 z-[100] h-[1.5px] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="h-full"
            style={{
              background: "linear-gradient(90deg, transparent 0%, #16C784 40%, #16C784 70%, transparent 100%)",
              boxShadow: "0 0 12px rgba(22,199,132,0.8)",
            }}
            initial={{ width: "0%", x: "-5%" }}
            animate={{ width: ["0%", "75%", "92%"] }}
            transition={{ duration: 14, ease: "easeOut", times: [0, 0.35, 1] }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
