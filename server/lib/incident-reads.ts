import { asc, eq } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import { parseMeta } from "./incidents.js";

type IncidentRow = typeof schema.incidents.$inferSelect;

export function incidentSummary(row: IncidentRow, serviceName: string | null) {
  return {
    id: row.id,
    title: row.title,
    severity: row.severity,
    status: row.status,
    serviceId: row.serviceId,
    serviceName,
    commanderEmail: row.commanderEmail,
    source: row.source,
    startedAt: row.startedAt,
    resolvedAt: row.resolvedAt,
    summary: row.summary,
    impact: row.impact,
    rootCause: row.rootCause,
    lessons: row.lessons,
    updatedAt: row.updatedAt,
  };
}

export async function serviceNameOf(serviceId: string | null) {
  if (!serviceId) return null;
  const [row] = await getDb()
    .select({ name: schema.services.name })
    .from(schema.services)
    .where(eq(schema.services.id, serviceId))
    .limit(1);
  return row?.name ?? null;
}

export async function loadTimeline(incidentId: string, limit = 500) {
  const rows = await getDb()
    .select()
    .from(schema.timelineEntries)
    .where(eq(schema.timelineEntries.incidentId, incidentId))
    .orderBy(asc(schema.timelineEntries.createdAt))
    .limit(limit);
  return rows.map(({ orgId: _o, meta, ...row }) => ({ ...row, meta: parseMeta(meta) }));
}

export async function loadUpdates(incidentId: string) {
  const rows = await getDb()
    .select()
    .from(schema.statusUpdates)
    .where(eq(schema.statusUpdates.incidentId, incidentId))
    .orderBy(asc(schema.statusUpdates.createdAt))
    .limit(200);
  return rows.map(({ orgId: _o, ...row }) => row);
}

export async function loadActionItems(incidentId: string) {
  const rows = await getDb()
    .select()
    .from(schema.actionItems)
    .where(eq(schema.actionItems.incidentId, incidentId))
    .orderBy(asc(schema.actionItems.createdAt))
    .limit(200);
  return rows.map(({ orgId: _o, ...row }) => row);
}
