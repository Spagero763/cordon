import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { accessFilter } from "@agent-native/core/sharing";
import { and, desc, inArray } from "drizzle-orm";
import { z } from "zod";

import { OPEN_STATUSES } from "../shared/incident.js";
import { getDb, schema } from "../server/db/index.js";
import { recentChecksByService } from "../server/lib/checks.js";
import { serviceShape } from "../server/lib/contracts.js";

const checkPoint = z.object({
  ok: z.boolean(),
  latencyMs: z.number().nullable(),
  checkedAt: z.string(),
});

export default defineAction({
  description:
    "List the monitored services the current user can see, with their latest check result, the last 24 checks (newest first), and any open incident id.",
  schema: z.object({}),
  outputSchema: z.object({
    services: z.array(serviceShape.extend({ recentChecks: z.array(checkPoint) })),
  }),
  http: { method: "GET" },
  readOnly: true,
  link: () => ({
    url: buildDeepLink({ view: "services", to: "/services" }),
    label: "Open services",
  }),
  run: async () => {
    const db = getDb();
    const { services, serviceShares, incidents } = schema;
    const rows = await db
      .select({
        id: services.id,
        name: services.name,
        url: services.url,
        repo: services.repo,
        checkIntervalMinutes: services.checkIntervalMinutes,
        enabled: services.enabled,
        isPublic: services.isPublic,
        oncallEmail: services.oncallEmail,
        lastCheckAt: services.lastCheckAt,
        lastCheckOk: services.lastCheckOk,
        consecutiveFailures: services.consecutiveFailures,
      })
      .from(services)
      .where(accessFilter(services, serviceShares))
      .orderBy(services.name)
      .limit(200);
    if (rows.length === 0) return { services: [] };

    const ids = rows.map((r) => r.id);
    const [open, checks] = await Promise.all([
      db
        .select({ id: incidents.id, serviceId: incidents.serviceId })
        .from(incidents)
        .where(and(inArray(incidents.serviceId, ids), inArray(incidents.status, [...OPEN_STATUSES])))
        .orderBy(desc(incidents.startedAt))
        .limit(500),
      recentChecksByService(ids),
    ]);
    const openByService = new Map<string, string>();
    for (const row of open) {
      if (row.serviceId && !openByService.has(row.serviceId)) {
        openByService.set(row.serviceId, row.id);
      }
    }
    return {
      services: rows.map((row) => ({
        ...row,
        openIncidentId: openByService.get(row.id) ?? null,
        recentChecks: checks.get(row.id) ?? [],
      })),
    };
  },
});
