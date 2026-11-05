import { AnimatePresence, motion } from "motion/react";

import { useNow } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ease } from "./motion";

function format(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

function Digit({ value }: { value: string }) {
  return (
    <span className="relative inline-block h-[1.1em] w-[0.62em] overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: "90%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-90%", opacity: 0 }}
          transition={{ duration: 0.3, ease }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A running clock for an open incident; a fixed duration once it has an end. */
export function Ticker({
  since,
  until,
  className,
}: {
  since: string;
  until?: string | null;
  className?: string;
}) {
  const now = useNow(until ? 3_600_000 : 1000);
  const text = format((until ? Date.parse(until) : now) - Date.parse(since));
  return (
    <span className={cn("inline-flex items-center font-mono tabular-nums leading-none", className)} aria-label={`Open for ${text}`}>
      {text.split("").map((char, index) =>
        /\d/.test(char) ? (
          <Digit key={text.length - index} value={char} />
        ) : (
          <span key={text.length - index} className="opacity-60">
            {char}
          </span>
        ),
      )}
    </span>
  );
}
