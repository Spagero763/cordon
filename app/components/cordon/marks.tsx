import type { ReactNode } from "react";

import {
  SEVERITY_LABEL,
  STATUS_LABEL,
  type IncidentStatus,
  type Severity,
} from "../../../shared/incident";
import { cn } from "@/lib/utils";

const SEVERITY_TONE: Record<Severity, string> = {
  sev1: "text-[hsl(var(--signal-ember))] border-[hsl(var(--signal-ember)/0.45)] bg-[hsl(var(--signal-ember)/0.08)]",
  sev2: "text-[hsl(var(--signal-amber))] border-[hsl(var(--signal-amber)/0.45)] bg-[hsl(var(--signal-amber)/0.08)]",
  sev3: "text-[hsl(var(--signal-slate))] border-[hsl(var(--signal-slate)/0.45)] bg-[hsl(var(--signal-slate)/0.08)]",
  sev4: "text-muted-foreground border-border bg-muted/40",
};

export function severityTone(severity: Severity) {
  return SEVERITY_TONE[severity];
}

export function SeverityBadge({
  severity,
  className,
  pulse = false,
}: {
  severity: Severity;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span
      data-severity={severity}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em]",
        SEVERITY_TONE[severity],
        pulse && "cordon-pulse-once",
        className,
      )}
      title={SEVERITY_LABEL[severity]}
    >
      {severity}
    </span>
  );
}

const STATUS_DOT: Record<IncidentStatus, string> = {
  investigating: "bg-[hsl(var(--signal-ember))]",
  identified: "bg-[hsl(var(--signal-amber))]",
  monitoring: "bg-[hsl(var(--signal-slate))]",
  resolved: "bg-[hsl(var(--signal-moss))]",
};

export function StatusPill({
  status,
  className,
  live = false,
}: {
  status: IncidentStatus;
  className?: string;
  live?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-2 rounded-full border border-border bg-background px-2.5 text-xs font-medium text-foreground",
        className,
      )}
    >
      <span className="relative flex size-2">
        {live && status === "investigating" ? (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden",
              STATUS_DOT[status],
            )}
          />
        ) : null}
        <span className={cn("relative inline-flex size-2 rounded-full", STATUS_DOT[status])} />
      </span>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function HealthDot({ ok, className }: { ok: boolean | null; className?: string }) {
  return (
    <span
      aria-label={ok === null ? "Not checked yet" : ok ? "Healthy" : "Failing"}
      className={cn(
        "relative inline-block size-2.5 rounded-full transition-colors duration-500",
        ok === null
          ? "bg-muted-foreground/40"
          : ok
            ? "bg-[hsl(var(--signal-moss))] shadow-[0_0_0_3px_hsl(var(--signal-moss)/0.18)]"
            : "bg-[hsl(var(--signal-ember))] shadow-[0_0_0_3px_hsl(var(--signal-ember)/0.2)]",
        className,
      )}
    >
      {ok === false ? (
        <span className="absolute inset-0 animate-ping rounded-full bg-[hsl(var(--signal-ember))] opacity-70 motion-reduce:hidden" />
      ) : null}
    </span>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[11px] tabular-nums text-muted-foreground", className)}>
      {children}
    </span>
  );
}
