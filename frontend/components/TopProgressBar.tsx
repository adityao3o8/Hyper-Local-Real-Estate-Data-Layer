"use client";

import { motion, AnimatePresence } from "framer-motion";

export function TopProgressBar({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-[100] h-[2px] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="h-full bg-[#16C784]"
            initial={{ width: "0%" }}
            animate={{ width: ["0%", "70%", "90%"] }}
            transition={{ duration: 12, ease: "easeOut", times: [0, 0.4, 1] }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
