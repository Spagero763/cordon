import { IconArrowUpRight } from "@tabler/icons-react";
import { Link } from "react-router";

import { INCIDENT_STATUSES, SEVERITIES, type IncidentStatus, type Severity } from "../../../shared/incident";
import { cn } from "@/lib/utils";

import { SeverityBadge, StatusPill } from "./marks";
import { Ticker } from "./Ticker";

export interface IncidentCardData {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  serviceName: string | null;
  commander: string | null;
  startedAt: string;
  resolvedAt: string | null;
}

export function readIncidentCard(value: unknown): IncidentCardData | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.title !== "string" || typeof v.startedAt !== "string") return null;
  if (!SEVERITIES.includes(v.severity as Severity) || !INCIDENT_STATUSES.includes(v.status as IncidentStatus)) return null;
  return {
    id: v.id,
    title: v.title,
    severity: v.severity as Severity,
    status: v.status as IncidentStatus,
    serviceName: typeof v.serviceName === "string" ? v.serviceName : null,
    commander: typeof v.commander === "string" ? v.commander : null,
    startedAt: v.startedAt,
    resolvedAt: typeof v.resolvedAt === "string" ? v.resolvedAt : null,
  };
}

/** The incident as it appears in the agent panel: enough to act on, one step from the room. */
export function IncidentCard({ incident, className }: { incident: IncidentCardData; className?: string }) {
  const open = incident.status !== "resolved";
  return (
    <Link
      to={`/incidents/${encodeURIComponent(incident.id)}`}
      className={cn(
        "group block rounded-lg border border-border bg-card p-3 text-start text-card-foreground no-underline transition-colors hover:bg-muted/40",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <SeverityBadge severity={incident.severity} />
        <StatusPill status={incident.status} live={open} />
        <Ticker since={incident.startedAt} until={incident.resolvedAt} className="ms-auto text-sm text-muted-foreground" />
      </div>
      <p className="mt-2 text-balance text-sm font-semibold leading-5 [overflow-wrap:anywhere]">{incident.title}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <span className="truncate">
          {incident.serviceName ? `${incident.serviceName} · ` : ""}
          {incident.commander ? `${incident.commander} is commander` : "No commander yet"}
        </span>
        <IconArrowUpRight className="ms-auto size-3.5 shrink-0 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-70" />
      </p>
    </Link>
  );
}
