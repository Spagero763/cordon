import { defineAction, fail } from "@agent-native/core/action";
import { assertAccess } from "@agent-native/core/sharing";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { actorFromCtx } from "../server/lib/access.js";
import { actionItemShape } from "../server/lib/contracts.js";
import { insertEntry } from "../server/lib/incidents.js";
import { newId, nowIso } from "../server/lib/ids.js";

export default defineAction({
  description:
    "Add a follow-up action item to an incident, usually from the postmortem. One verb, one owner. Leave assigneeEmail empty rather than guessing.",
  schema: z.object({
    incidentId: z.string().describe("Incident id"),
    title: z.string().min(3).max(200).describe('The task, e.g. "Add a canary check for the payments deploy"'),
    assigneeEmail: z.string().email().optional().describe("Owner email; omit if unknown"),
    dueAt: z.string().datetime({ offset: true }).optional().describe("Due date, ISO 8601 with offset"),
  }),
  outputSchema: actionItemShape,
  mcpAnnotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  run: async ({ incidentId, title, assigneeEmail, dueAt }, ctx) => {
    await assertAccess("incident", incidentId, "editor");
    const db = getDb();
    const [incident] = await db
      .select({ orgId: schema.incidents.orgId })
      .from(schema.incidents)
      .where(eq(schema.incidents.id, incidentId))
      .limit(1);
    if (!incident) fail("Incident not found.", { errorCode: "not_found", statusCode: 404 });
    const row = {
      id: newId(),
      incidentId,
      title: title.trim(),
      assigneeEmail: assigneeEmail ?? null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      done: false,
      createdAt: nowIso(),
      orgId: incident.orgId,
    };
    await db.transaction(async (tx) => {
      await tx.insert(schema.actionItems).values(row);
      await insertEntry(tx, {
        incidentId,
        kind: "action-item",
        body: `Action item: ${row.title}${row.assigneeEmail ? ` (${row.assigneeEmail})` : ""}`,
        actor: actorFromCtx(ctx),
        orgId: incident.orgId,
        meta: { actionItemId: row.id },
      });
    });
    const { orgId: _o, ...out } = row;
    return out;
  },
});
