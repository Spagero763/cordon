import { and, desc, eq, gt } from "drizzle-orm";

import type { Severity } from "../../shared/incident.js";
import { getDb, schema } from "../db/index.js";
import { newId, nowIso } from "./ids.js";
import {
  declareIncident,
  insertEntry,
  openIncidentForService,
  touchIncident,
  type Actor,
  type ServiceRow,
} from "./incidents.js";

const GROUP_WINDOW_MS = 30 * 60_000;

export async function ingestAlert(input: {
  service: ServiceRow | null;
  source: string;
  title: string;
  body: string | null;
  fingerprint: string | null;
  severity: Severity;
  actor: Actor;
  ownerEmail: string;
  orgId: string | null;
}) {
  const db = getDb();
  const fingerprint = (input.fingerprint ?? `${input.source}:${input.title}`).slice(0, 200);
  const receivedAt = nowIso();
  const windowStart = new Date(Date.now() - GROUP_WINDOW_MS).toISOString();

  return db.transaction(async (tx) => {
    const [recent] = await tx
      .select({ incidentId: schema.alerts.incidentId })
      .from(schema.alerts)
      .where(and(eq(schema.alerts.fingerprint, fingerprint), gt(schema.alerts.receivedAt, windowStart)))
      .orderBy(desc(schema.alerts.receivedAt))
      .limit(1);

    let incidentId = recent?.incidentId ?? null;
    let grouped = Boolean(incidentId);
    let declared = false;

    if (incidentId) {
      const [still] = await tx
        .select({ status: schema.incidents.status })
        .from(schema.incidents)
        .where(eq(schema.incidents.id, incidentId))
        .limit(1);
      if (!still || still.status === "resolved") {
        incidentId = null;
        grouped = false;
      }
    }

    if (!incidentId && input.service) {
      const open = await openIncidentForService(tx, input.service.id);
      incidentId = open?.id ?? null;
    }

    if (!incidentId) {
      const incident = await declareIncident(tx, {
        title: input.title,
        severity: input.severity,
        serviceId: input.service?.id ?? null,
        source: "alert",
        actor: input.actor,
        ownerEmail: input.ownerEmail,
        orgId: input.orgId,
        body: `Alert from ${input.source}: ${input.title}`,
      });
      incidentId = incident.id;
      declared = true;
    } else if (!grouped) {
      await insertEntry(tx, {
        incidentId,
        kind: "alert",
        body: `${input.source}: ${input.title}`,
        actor: input.actor,
        orgId: input.orgId,
        meta: { source: input.source, fingerprint },
      });
      await touchIncident(tx, incidentId);
    }

    const alertId = newId();
    await tx.insert(schema.alerts).values({
      id: alertId,
      serviceId: input.service?.id ?? null,
      incidentId,
      source: input.source,
      fingerprint,
      title: input.title,
      body: input.body,
      receivedAt,
      orgId: input.orgId,
    });

    return { alertId, incidentId, declared, grouped };
  });
}
