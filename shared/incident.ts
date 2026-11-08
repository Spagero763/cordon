export const SEVERITIES = ["sev1", "sev2", "sev3", "sev4"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const INCIDENT_STATUSES = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const OPEN_STATUSES: readonly IncidentStatus[] = [
  "investigating",
  "identified",
  "monitoring",
];

export const ENTRY_KINDS = [
  "declared",
  "note",
  "hypothesis",
  "status",
  "severity",
  "commander",
  "check",
  "alert",
  "update",
  "action-item",
  "resolved",
  "reopened",
  "paged",
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const ACTOR_KINDS = ["person", "agent", "monitor", "webhook"] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const INCIDENT_SOURCES = ["manual", "monitor", "alert"] as const;
export type IncidentSource = (typeof INCIDENT_SOURCES)[number];

export const SEVERITY_LABEL: Record<Severity, string> = {
  sev1: "Critical",
  sev2: "Major",
  sev3: "Minor",
  sev4: "Low",
};

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

export const FAILURES_BEFORE_INCIDENT = 2;

export function isOpenStatus(status: string): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
