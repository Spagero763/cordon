import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { assertAccess } from "@agent-native/core/sharing";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { INCIDENT_CARD_RENDERER, incidentCard, incidentDetailShape } from "../server/lib/contracts.js";
import { namesFor } from "../server/lib/people.js";
import {
  incidentSummary,
  loadActionItems,
  loadTimeline,
  loadUpdates,
  serviceNameOf,
} from "../server/lib/incident-reads.js";

export default defineAction({
  description:
    "Read one incident in full: its fields, the whole timeline in order, customer updates (drafts and published), and action items. Call this before acting on an incident.",
  schema: z.object({ id: z.string().describe("Incident id") }),
  outputSchema: incidentDetailShape,
  chatUI: { renderer: INCIDENT_CARD_RENDERER, projectResult: (_args, result) => incidentCard(result) },
  http: { method: "GET" },
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: true },
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "incident",
      to: `/incidents/${encodeURIComponent(args.id)}`,
      params: { incidentId: args.id },
    }),
    label: "Open incident",
  }),
  run: async ({ id }) => {
    await assertAccess("incident", id, "viewer");
    const [row] = await getDb()
      .select()
      .from(schema.incidents)
      .where(eq(schema.incidents.id, id))
      .limit(1);
    if (!row) fail("Incident not found.", { errorCode: "not_found", statusCode: 404 });
    const [serviceName, timeline, updates, actionItems] = await Promise.all([
      serviceNameOf(row.serviceId),
      loadTimeline(id),
      loadUpdates(id),
      loadActionItems(id),
    ]);
    const people = await namesFor([row.commanderEmail, ...timeline.map((e) => e.actorEmail)]);
    return { ...incidentSummary(row, serviceName), timeline, updates, actionItems, people };
  },
});
