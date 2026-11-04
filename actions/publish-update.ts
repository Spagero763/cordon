import { defineAction, fail } from "@agent-native/core/action";
import { assertAccess } from "@agent-native/core/sharing";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { STATUS_LABEL } from "../shared/incident.js";
import { getDb, schema } from "../server/db/index.js";
import { actorFromCtx } from "../server/lib/access.js";
import { updateShape } from "../server/lib/contracts.js";
import { insertEntry, touchIncident } from "../server/lib/incidents.js";
import { nowIso } from "../server/lib/ids.js";

export default defineAction({
  description:
    "Publish a drafted customer update to the public status page and the timeline. Requires a person to approve the exact draft. Cannot be undone.",
  schema: z.object({ id: z.string().describe("Draft update id from draft-update") }),
  outputSchema: updateShape,
  needsApproval: true,
  mcpAnnotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  run: async ({ id }, ctx) => {
    const db = getDb();
    const [draft] = await db
      .select()
      .from(schema.statusUpdates)
      .where(eq(schema.statusUpdates.id, id))
      .limit(1);
    if (!draft) fail("Draft not found.", { errorCode: "not_found", statusCode: 404 });
    await assertAccess("incident", draft.incidentId, "editor");
    if (draft.published) fail("This update is already published.", { errorCode: "already_published", statusCode: 409 });

    const publishedAt = nowIso();
    const row = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.statusUpdates)
        .set({ published: true, publishedAt, updatedAt: publishedAt, authorEmail: ctx?.userEmail ?? draft.authorEmail })
        .where(and(eq(schema.statusUpdates.id, id), eq(schema.statusUpdates.published, false)))
        .returning();
      if (!updated) fail("This update is already published.", { errorCode: "already_published", statusCode: 409 });
      await insertEntry(tx, {
        incidentId: draft.incidentId,
        kind: "update",
        body: updated.body,
        actor: actorFromCtx(ctx),
        orgId: draft.orgId,
        meta: { updateId: id, state: updated.state, label: STATUS_LABEL[updated.state] },
      });
      await touchIncident(tx, draft.incidentId);
      return updated;
    });
    const { orgId: _o, ...out } = row;
    return out;
  },
});
