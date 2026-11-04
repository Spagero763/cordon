import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { accessFilter } from "@agent-native/core/sharing";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { actorFromCtx, orgOf, requireUser } from "../server/lib/access.js";
import { ingestAlert } from "../server/lib/alerts.js";
import { severitySchema } from "../server/lib/contracts.js";

export default defineAction({
  description:
    "Record an alert from a monitoring tool or a person. Attaches it to the service's open incident, or opens a new incident when none exists. Alerts with the same fingerprint inside 30 minutes are grouped. Use this for anything that is not a Cordon check: Sentry errors, Grafana alarms, a customer report.",
  schema: z.object({
    serviceId: z.string().optional().describe("Service the alert belongs to; omit if unknown"),
    source: z.string().min(1).max(40).describe('Where it came from, e.g. "sentry", "grafana", "customer"'),
    title: z.string().min(1).max(200).describe("One-line alert title"),
    body: z.string().max(4000).optional().describe("Details, stack trace excerpt, or message"),
    fingerprint: z.string().max(200).optional().describe("Stable id for this alert type; defaults to source plus title"),
    severity: severitySchema.default("sev2").describe("Severity to use if a new incident is opened; defaults to sev2"),
  }),
  outputSchema: z.object({
    alertId: z.string(),
    incidentId: z.string(),
    declared: z.boolean(),
    grouped: z.boolean(),
  }),
  mcpAnnotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "incident",
      to: `/incidents/${encodeURIComponent(result.incidentId)}`,
      params: { incidentId: result.incidentId },
    }),
    label: "Open incident",
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireUser(ctx);
    const orgId = orgOf(ctx);
    const db = getDb();
    let service = null;
    if (args.serviceId) {
      const [row] = await db
        .select()
        .from(schema.services)
        .where(and(eq(schema.services.id, args.serviceId), accessFilter(schema.services, schema.serviceShares)))
        .limit(1);
      if (!row) fail("Service not found.", { errorCode: "not_found", statusCode: 404 });
      service = row;
    }
    return ingestAlert({
      service,
      source: args.source,
      title: args.title,
      body: args.body ?? null,
      fingerprint: args.fingerprint ?? null,
      severity: args.severity,
      actor: actorFromCtx(ctx),
      ownerEmail: service?.ownerEmail ?? ownerEmail,
      orgId: service?.orgId ?? orgId,
    });
  },
});
