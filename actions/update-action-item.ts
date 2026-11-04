import { defineAction, fail } from "@agent-native/core/action";
import { assertAccess } from "@agent-native/core/sharing";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { actionItemShape } from "../server/lib/contracts.js";

export default defineAction({
  description: "Mark an action item done or not done, or change its title, owner, or due date. Pass only what changes.",
  schema: z.object({
    id: z.string().describe("Action item id"),
    done: z.boolean().optional().describe("true when completed"),
    title: z.string().min(3).max(200).optional().describe("New title"),
    assigneeEmail: z.string().email().nullable().optional().describe("Owner email, or null to clear"),
    dueAt: z.string().datetime({ offset: true }).nullable().optional().describe("Due date, ISO 8601 with offset, or null to clear"),
  }),
  outputSchema: actionItemShape,
  mcpAnnotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  run: async ({ id, ...patch }) => {
    const db = getDb();
    const [item] = await db
      .select({ incidentId: schema.actionItems.incidentId })
      .from(schema.actionItems)
      .where(eq(schema.actionItems.id, id))
      .limit(1);
    if (!item) fail("Action item not found.", { errorCode: "not_found", statusCode: 404 });
    await assertAccess("incident", item.incidentId, "editor");
    const changes: Partial<typeof schema.actionItems.$inferInsert> = {};
    if (patch.done !== undefined) changes.done = patch.done;
    if (patch.title !== undefined) changes.title = patch.title.trim();
    if (patch.assigneeEmail !== undefined) changes.assigneeEmail = patch.assigneeEmail;
    if (patch.dueAt !== undefined) changes.dueAt = patch.dueAt ? new Date(patch.dueAt).toISOString() : null;
    if (Object.keys(changes).length === 0) fail("Nothing to change.", { errorCode: "empty_patch" });
    const [row] = await db
      .update(schema.actionItems)
      .set(changes)
      .where(eq(schema.actionItems.id, id))
      .returning();
    if (!row) fail("Action item not found.", { errorCode: "not_found", statusCode: 404 });
    const { orgId: _o, ...out } = row;
    return out;
  },
});
