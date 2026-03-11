import { useEffect } from "react";
import { motion } from "framer-motion";
import type { XPEvent } from "@/types/gamification";
import { formatXP } from "@/lib/format";

interface XPPopupProps {
  event: XPEvent;
  onComplete: () => void;
}

export function XPPopup({ event, onComplete }: XPPopupProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="pointer-events-none fixed bottom-24 right-8 z-50 flex items-center gap-2"
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -60, scale: 1.2 }}
      transition={{ duration: 1.4, ease: "easeOut" }}
    >
      <div className="rounded-xl bg-accent-500 px-4 py-2 text-lg font-bold text-white shadow-lg">
        +{formatXP(event.amount)} XP
      </div>
    </motion.div>
  );
}
