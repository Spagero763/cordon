import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

import { ease } from "./motion";

/**
 * The cordon itself: a hazard stripe that is only on screen while something
 * is open. It draws across when the first incident opens and retracts at all
 * clear. It marches only while the cause is still unknown; once someone has
 * identified it, the stripe holds still.
 */
export function CordonStripe({
  active,
  live = active,
  className,
}: {
  active: boolean;
  live?: boolean;
  className?: string;
}) {
  return (
    <AnimatePresence initial>
      {active ? (
        <motion.div
          key="stripe"
          aria-hidden="true"
          data-live={live ? "true" : "false"}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ scaleX: 0, opacity: 0, originX: 1 }}
          transition={{ duration: 0.7, ease }}
          className={cn("cordon-stripe relative z-10 h-1.5 w-full origin-left", className)}
        />
      ) : null}
    </AnimatePresence>
  );
}
