import { defineNitroPlugin } from "@agent-native/core";
import { registerEvent } from "@agent-native/core/event-bus";
import { registerJobRunner } from "@agent-native/core/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { severitySchema } from "../lib/contracts.js";
import { checkServices } from "../lib/checks.js";
import { INCIDENT_OPENED } from "../lib/opened.js";
import { WATCH_RUNNER } from "../lib/watch-job.js";
import { getDb, schema } from "../db/index.js";

registerEvent({
  name: INCIDENT_OPENED,
  description: "A check or an alert opened an incident with nobody in the room.",
  payloadSchema: z.object({
    incidentId: z.string(),
    title: z.string(),
    severity: severitySchema,
    source: z.enum(["monitor", "alert"]),
    serviceId: z.string().nullable(),
  }),
  example: {
    incidentId: "inc_01",
    title: "API is failing checks",
    severity: "sev2",
    source: "monitor",
    serviceId: "svc_01",
  },
});

// The watch job runs here, as the workspace it belongs to, with no model.
registerJobRunner(WATCH_RUNNER, async (ctx) => {
  const { services } = schema;
  const tenant = ctx.orgId
    ? eq(services.orgId, ctx.orgId)
    : and(isNull(services.orgId), eq(services.ownerEmail, ctx.ownerEmail));
  const rows = await getDb()
    .select()
    .from(services)
    .where(and(eq(services.enabled, true), tenant))
    .limit(200);
  if (rows.length === 0) return { status: "skipped", reason: "No services to watch." };
  const result = await checkServices(rows, { force: ctx.manual, signal: ctx.signal });
  if (result.checks.length === 0) return { status: "skipped", reason: "No service was due." };
  return { status: "success" };
});

export default defineNitroPlugin(() => {});
