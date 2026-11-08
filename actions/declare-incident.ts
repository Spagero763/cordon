import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { accessFilter } from "@agent-native/core/sharing";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { actorFromCtx, orgOf, requireUser } from "../server/lib/access.js";
import { INCIDENT_CARD_RENDERER, incidentCard, incidentShape, severitySchema } from "../server/lib/contracts.js";
import { declareIncident } from "../server/lib/incidents.js";
import { afterIncidentOpened } from "../server/lib/opened.js";

export default defineAction({
  description:
    "Open a new incident. Use when a person reports something broken or you have evidence of an outage that no open incident covers. Pick the severity from the incident-command skill rubric. The caller becomes commander when they are a person.",
  schema: z.object({
    title: z.string().min(3).max(140).describe('What is broken as a user sees it, e.g. "Checkout returns 500 for card payments"'),
    severity: severitySchema.describe("sev1 critical, sev2 major, sev3 minor, sev4 low"),
    serviceId: z.string().optional().describe("Affected service id from list-services; omit if unknown"),
    summary: z.string().max(2000).optional().describe("What is known so far, one short paragraph"),
    startedAt: z
      .string()
      .datetime({ offset: true })
      .optional()
      .describe("When impact began, ISO 8601 with offset; defaults to now"),
  }),
  outputSchema: incidentShape,
  chatUI: { renderer: INCIDENT_CARD_RENDERER, projectResult: (_args, result) => incidentCard(result) },
  mcpAnnotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "incident",
      to: `/incidents/${encodeURIComponent(result.id)}`,
      params: { incidentId: result.id },
    }),
    label: `Open ${result.title}`,
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireUser(ctx);
    const orgId = orgOf(ctx);
    const db = getDb();
    let serviceName: string | null = null;
    if (args.serviceId) {
      const [service] = await db
        .select({ name: schema.services.name })
        .from(schema.services)
        .where(and(eq(schema.services.id, args.serviceId), accessFilter(schema.services, schema.serviceShares)))
        .limit(1);
      if (!service) fail("Service not found.", { errorCode: "not_found", statusCode: 404 });
      serviceName = service.name;
    }
    const incident = await declareIncident(db, {
      title: args.title.trim(),
      severity: args.severity,
      serviceId: args.serviceId ?? null,
      source: "manual",
      summary: args.summary ?? null,
      actor: actorFromCtx(ctx),
      ownerEmail,
      orgId,
      startedAt: args.startedAt ? new Date(args.startedAt).toISOString() : undefined,
    });
    await afterIncidentOpened(incident.id);
    return {
      id: incident.id,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      serviceId: incident.serviceId,
      serviceName,
      commanderEmail: incident.commanderEmail,
      source: incident.source,
      startedAt: incident.startedAt,
      resolvedAt: incident.resolvedAt,
      summary: incident.summary,
      impact: incident.impact,
      rootCause: incident.rootCause,
      lessons: incident.lessons,
      updatedAt: incident.updatedAt,
    };
  },
});
