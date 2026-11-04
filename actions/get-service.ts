import { defineAction, fail } from "@agent-native/core/action";
import { assertAccess } from "@agent-native/core/sharing";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { checkShape, serviceShape } from "../server/lib/contracts.js";
import { openIncidentForService } from "../server/lib/incidents.js";

export default defineAction({
  description:
    "Read one service with its webhook path for external alerts and its last 30 checks. Editors only, because the webhook path is a credential.",
  schema: z.object({ id: z.string().describe("Service id") }),
  outputSchema: serviceShape.extend({
    webhookPath: z.string(),
    checks: z.array(checkShape),
  }),
  http: { method: "GET" },
  readOnly: true,
  persistInBrowser: false,
  run: async ({ id }) => {
    await assertAccess("service", id, "editor");
    const db = getDb();
    const [row] = await db.select().from(schema.services).where(eq(schema.services.id, id)).limit(1);
    if (!row) fail("Service not found.", { errorCode: "not_found", statusCode: 404 });
    const [open, checks] = await Promise.all([
      openIncidentForService(db, id),
      db
        .select()
        .from(schema.checks)
        .where(eq(schema.checks.serviceId, id))
        .orderBy(desc(schema.checks.checkedAt))
        .limit(30),
    ]);
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      repo: row.repo,
      checkIntervalMinutes: row.checkIntervalMinutes,
      enabled: row.enabled,
      isPublic: row.isPublic,
      oncallEmail: row.oncallEmail,
      lastCheckAt: row.lastCheckAt,
      lastCheckOk: row.lastCheckOk,
      consecutiveFailures: row.consecutiveFailures,
      openIncidentId: open?.id ?? null,
      webhookPath: `/api/alerts/${row.webhookToken}`,
      checks: checks.map(({ orgId: _o, ...check }) => check),
    };
  },
});
