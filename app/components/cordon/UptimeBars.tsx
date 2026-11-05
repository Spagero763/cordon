import { motion } from "motion/react";

import { clock } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ease } from "./motion";

export interface CheckPoint {
  ok: boolean;
  latencyMs: number | null;
  checkedAt: string;
}

/** Newest check on the right. Height follows latency, colour follows the result. */
export function UptimeBars({
  checks,
  slots = 24,
  className,
}: {
  checks: CheckPoint[];
  slots?: number;
  className?: string;
}) {
  const ordered = [...checks].slice(0, slots).reverse();
  const cells: Array<CheckPoint | null> = [
    ...Array.from({ length: Math.max(0, slots - ordered.length) }, () => null),
    ...ordered,
  ];
  const slowest = Math.max(1, ...ordered.map((c) => c.latencyMs ?? 0));

  return (
    <div
      role="img"
      aria-label={`Last ${ordered.length} checks, ${ordered.filter((c) => !c.ok).length} failed`}
      className={cn("flex h-6 items-end gap-[2px]", className)}
    >
      {cells.map((cell, index) => (
        <motion.span
          key={cell ? cell.checkedAt : `empty-${index}`}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ delay: index * 0.016, duration: 0.4, ease }}
          style={{
            height: cell ? `${38 + 62 * ((cell.latencyMs ?? slowest) / slowest)}%` : "22%",
            transformOrigin: "bottom",
          }}
          title={cell ? `${clock(cell.checkedAt, true)} · ${cell.ok ? `${cell.latencyMs}ms` : "failed"}` : undefined}
          className={cn(
            "w-[3px] rounded-[1px]",
            !cell
              ? "bg-muted-foreground/15"
              : cell.ok
                ? "bg-[hsl(var(--signal-moss)/0.85)]"
                : "bg-[hsl(var(--signal-ember))]",
          )}
        />
      ))}
    </div>
  );
}
