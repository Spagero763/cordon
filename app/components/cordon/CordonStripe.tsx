import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * The cordon itself: a hazard stripe that is only on screen while something
 * is open. It slides in when the first incident opens and out at all clear.
 */
export function CordonStripe({ active, className }: { active: boolean; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {active ? (
        <motion.div
          key="stripe"
          aria-hidden="true"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ scaleX: 0, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={cn("cordon-stripe h-1 w-full origin-left", className)}
        />
      ) : null}
    </AnimatePresence>
  );
}
