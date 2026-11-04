import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { accessFilter } from "@agent-native/core/sharing";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { OPEN_STATUSES } from "../shared/incident.js";
import { getDb, schema } from "../server/db/index.js";
import { incidentShape } from "../server/lib/contracts.js";
import { incidentSummary } from "../server/lib/incident-reads.js";

export default defineAction({
  description:
    'List incidents the current user can see, newest first. filter "open" (default) returns investigating, identified and monitoring; "resolved" returns closed ones; "all" returns both.',
  schema: z.object({
    filter: z.enum(["open", "resolved", "all"]).default("open").describe('"open", "resolved", or "all"; defaults to "open"'),
    limit: z.coerce.number().int().min(1).max(200).default(50).describe("Max rows; defaults to 50"),
  }),
  outputSchema: z.object({ incidents: z.array(incidentShape) }),
  http: { method: "GET" },
  readOnly: true,
  link: () => ({
    url: buildDeepLink({ view: "incidents", to: "/incidents" }),
    label: "Open incidents",
  }),
  run: async ({ filter, limit }) => {
    const db = getDb();
    const { incidents, incidentShares, services } = schema;
    const statusWhere =
      filter === "open"
        ? inArray(incidents.status, [...OPEN_STATUSES])
        : filter === "resolved"
          ? eq(incidents.status, "resolved")
          : undefined;
    const rows = await db
      .select({ incident: incidents, serviceName: services.name })
      .from(incidents)
      .leftJoin(services, eq(services.id, incidents.serviceId))
      .where(and(accessFilter(incidents, incidentShares), statusWhere))
      .orderBy(desc(incidents.startedAt))
      .limit(limit);
    return {
      incidents: rows.map(({ incident, serviceName }) => incidentSummary(incident, serviceName)),
    };
  },
});
