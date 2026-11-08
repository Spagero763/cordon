import { defineAction, fail } from "@agent-native/core/action";
import { accessFilter } from "@agent-native/core/sharing";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { checkShape } from "../server/lib/contracts.js";
import { checkServices } from "../server/lib/checks.js";
import { ensureWatchJob } from "../server/lib/watch-job.js";

export default defineAction({
  description:
    "Ping every enabled service now (or one service by id), record the results, open an incident after two consecutive failures, and log recoveries on open incidents. Returns each check plus the ids of incidents it opened.",
  schema: z.object({
    serviceId: z.string().optional().describe("Check only this service; omit to check all enabled services"),
    force: z.boolean().default(false).describe("Check even if the service's interval has not elapsed; defaults to false"),
  }),
  outputSchema: z.object({
    checks: z.array(
      checkShape.extend({
        serviceName: z.string(),
        incidentId: z.string().nullable(),
        declared: z.boolean(),
        recovered: z.boolean(),
      }),
    ),
    skipped: z.number(),
    declaredIncidentIds: z.array(z.string()),
  }),
  parallelSafe: true,
  mcpAnnotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  run: async ({ serviceId, force }, ctx) => {
    try {
      await ensureWatchJob(ctx);
    } catch (error) {
      console.warn("[cordon] watch job was not created:", error instanceof Error ? error.message : error);
    }
    const db = getDb();
    const { services, serviceShares } = schema;
    const where = serviceId
      ? and(eq(services.id, serviceId), accessFilter(services, serviceShares))
      : and(eq(services.enabled, true), accessFilter(services, serviceShares));
    const rows = await db.select().from(services).where(where).limit(100);
    if (serviceId && rows.length === 0) {
      fail("Service not found.", { errorCode: "not_found", statusCode: 404 });
    }

    return checkServices(rows, { force: force || Boolean(serviceId) });
  },
});
