import { and, desc, eq, inArray } from "drizzle-orm";

import {
  FAILURES_BEFORE_INCIDENT,
  OPEN_STATUSES,
  type ActorKind,
  type EntryKind,
  type IncidentSource,
  type IncidentStatus,
  type Severity,
} from "../../shared/incident.js";
import { getDb, schema } from "../db/index.js";
import { newId, nowIso } from "./ids.js";

export interface Actor {
  email: string | null;
  kind: ActorKind;
}

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Writer = Db | Tx;

export async function insertEntry(
  db: Writer,
  input: {
    incidentId: string;
    kind: EntryKind;
    body: string;
    actor: Actor;
    orgId: string | null;
    meta?: Record<string, unknown> | undefined;
  },
) {
  const row = {
    id: newId(),
    incidentId: input.incidentId,
    kind: input.kind,
    body: input.body,
    actorEmail: input.actor.email,
    actorKind: input.actor.kind,
    meta: input.meta ? JSON.stringify(input.meta) : null,
    createdAt: nowIso(),
    orgId: input.orgId,
  };
  await db.insert(schema.timelineEntries).values(row);
  return row;
}

export async function touchIncident(db: Writer, incidentId: string) {
  await db
    .update(schema.incidents)
    .set({ updatedAt: nowIso() })
    .where(eq(schema.incidents.id, incidentId));
}

export async function openIncidentForService(db: Writer, serviceId: string) {
  const [row] = await db
    .select({ id: schema.incidents.id, status: schema.incidents.status })
    .from(schema.incidents)
    .where(
      and(
        eq(schema.incidents.serviceId, serviceId),
        inArray(schema.incidents.status, [...OPEN_STATUSES]),
      ),
    )
    .orderBy(desc(schema.incidents.startedAt))
    .limit(1);
  return row ?? null;
}

export async function declareIncident(
  db: Writer,
  input: {
    title: string;
    severity: Severity;
    serviceId: string | null;
    source: IncidentSource;
    summary?: string | null | undefined;
    actor: Actor;
    ownerEmail: string;
    orgId: string | null;
    startedAt?: string | undefined;
    body?: string | undefined;
  },
) {
  const now = nowIso();
  const incident = {
    id: newId(),
    title: input.title,
    severity: input.severity,
    status: "investigating" as IncidentStatus,
    serviceId: input.serviceId,
    commanderEmail:
      input.actor.kind === "person" ? input.actor.email : null,
    source: input.source,
    startedAt: input.startedAt ?? now,
    resolvedAt: null,
    summary: input.summary ?? null,
    impact: null,
    rootCause: null,
    lessons: null,
    createdAt: now,
    updatedAt: now,
    ownerEmail: input.ownerEmail,
    orgId: input.orgId,
    visibility: input.orgId ? ("org" as const) : ("private" as const),
  };
  await db.insert(schema.incidents).values(incident);
  await insertEntry(db, {
    incidentId: incident.id,
    kind: "declared",
    body: input.body ?? `Incident declared: ${input.title}`,
    actor: input.actor,
    orgId: input.orgId,
    meta: { severity: input.severity, source: input.source },
  });
  return incident;
}

interface CheckOutcome {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
}

export async function probe(
  url: string,
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>,
): Promise<CheckOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const started = Date.now();
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "cordon-monitor/1" },
    });
    const latencyMs = Date.now() - started;
    const ok = response.status >= 200 && response.status < 400;
    return {
      ok,
      statusCode: response.status,
      latencyMs,
      error: ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Timed out after 10s"
        : error instanceof Error
          ? error.message.slice(0, 200)
          : "Request failed";
    return {
      ok: false,
      statusCode: null,
      latencyMs: Date.now() - started,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export type ServiceRow = typeof schema.services.$inferSelect;

/**
 * Records one check for a service and keeps the incident state consistent:
 * repeated failures open an incident, a recovery logs itself on the open one.
 */
export async function recordCheck(
  service: ServiceRow,
  outcome: CheckOutcome,
) {
  const db = getDb();
  const checkedAt = nowIso();
  const check = {
    id: newId(),
    serviceId: service.id,
    checkedAt,
    ok: outcome.ok,
    statusCode: outcome.statusCode,
    latencyMs: outcome.latencyMs,
    error: outcome.error,
    orgId: service.orgId,
  };
  const monitor: Actor = { email: null, kind: "monitor" };

  return db.transaction(async (tx) => {
    await tx.insert(schema.checks).values(check);
    const failures = outcome.ok ? 0 : service.consecutiveFailures + 1;
    await tx
      .update(schema.services)
      .set({ lastCheckAt: checkedAt, lastCheckOk: outcome.ok, consecutiveFailures: failures })
      .where(eq(schema.services.id, service.id));

    const open = await openIncidentForService(tx, service.id);
    const wasFailing = service.lastCheckOk === false;

    if (!outcome.ok && !open && failures >= FAILURES_BEFORE_INCIDENT) {
      const incident = await declareIncident(tx, {
        title: `${service.name} is failing checks`,
        severity: "sev2",
        serviceId: service.id,
        source: "monitor",
        actor: monitor,
        ownerEmail: service.ownerEmail,
        orgId: service.orgId,
        startedAt: service.lastCheckAt ?? checkedAt,
        body: `${failures} consecutive failed checks on ${service.url}: ${outcome.error}`,
      });
      return { check, incidentId: incident.id, declared: true, recovered: false };
    }

    if (open && !outcome.ok && !wasFailing) {
      await insertEntry(tx, {
        incidentId: open.id,
        kind: "check",
        body: `Check failed: ${outcome.error}`,
        actor: monitor,
        orgId: service.orgId,
        meta: { statusCode: outcome.statusCode, latencyMs: outcome.latencyMs },
      });
      await touchIncident(tx, open.id);
    }

    if (open && outcome.ok && wasFailing) {
      await insertEntry(tx, {
        incidentId: open.id,
        kind: "check",
        body: `Check recovered: HTTP ${outcome.statusCode} in ${outcome.latencyMs}ms`,
        actor: monitor,
        orgId: service.orgId,
        meta: { statusCode: outcome.statusCode, latencyMs: outcome.latencyMs },
      });
      await touchIncident(tx, open.id);
      return { check, incidentId: open.id, declared: false, recovered: true };
    }

    return { check, incidentId: open?.id ?? null, declared: false, recovered: false };
  });
}

export function parseMeta(meta: string | null): Record<string, unknown> | null {
  if (!meta) return null;
  try {
    const parsed = JSON.parse(meta);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
