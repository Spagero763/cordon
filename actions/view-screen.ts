import { defineAction } from "@agent-native/core/action";
import {
  readAppState,
  readAppStateForCurrentTab,
} from "@agent-native/core/application-state";
import { resolveAccess } from "@agent-native/core/sharing";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { incidentSummary, loadUpdates, serviceNameOf } from "../server/lib/incident-reads.js";
import { parseMeta } from "../server/lib/incidents.js";

export default defineAction({
  description:
    "Snapshot of what the person is looking at: the current view, and when an incident is open, its fields, the newest timeline entries, unpublished drafts, and any entries they have selected. Basic navigation is already in <current-screen>; call this for a fresh read before acting on an incident.",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async () => {
    const navigation = (await readAppState("navigation")) as Record<string, unknown> | null;
    const screen: Record<string, unknown> = {};
    if (navigation) screen.navigation = navigation;

    const selection = await readAppStateForCurrentTab("selection");
    if (selection) screen.selection = selection;

    const incidentId = typeof navigation?.incidentId === "string" ? navigation.incidentId : null;
    if (incidentId) {
      const access = await resolveAccess("incident", incidentId);
      if (access) {
        const db = getDb();
        const [row] = await db
          .select()
          .from(schema.incidents)
          .where(eq(schema.incidents.id, incidentId))
          .limit(1);
        if (row) {
          const [entries, updates, serviceName] = await Promise.all([
            db
              .select()
              .from(schema.timelineEntries)
              .where(eq(schema.timelineEntries.incidentId, incidentId))
              .orderBy(desc(schema.timelineEntries.createdAt))
              .limit(15),
            loadUpdates(incidentId),
            serviceNameOf(row.serviceId),
          ]);
          screen.incident = incidentSummary(row, serviceName);
          screen.latestEntries = entries
            .reverse()
            .map(({ orgId: _o, meta, ...entry }) => ({ ...entry, meta: parseMeta(meta) }));
          screen.drafts = updates.filter((u) => !u.published);
          screen.publishedUpdateCount = updates.length - (screen.drafts as unknown[]).length;
        }
      }
    }

    if (Object.keys(screen).length === 0) {
      return { message: "No application state found. Is the app open in a browser?" };
    }
    return screen;
  },
});
