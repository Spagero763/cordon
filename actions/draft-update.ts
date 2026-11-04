import { defineAction, fail } from "@agent-native/core/action";
import { assertAccess } from "@agent-native/core/sharing";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { incidentStatusSchema, updateShape } from "../server/lib/contracts.js";
import { newId, nowIso } from "../server/lib/ids.js";

export default defineAction({
  description:
    "Write or edit a customer-facing status update as a draft. Nothing is published until a person approves publish-update. Pass id to edit an existing draft; published updates cannot be edited. Follow the customer-updates skill for wording.",
  schema: z.object({
    incidentId: z.string().describe("Incident id"),
    body: z.string().min(1).max(1200).describe("The update text customers will read"),
    state: incidentStatusSchema.optional().describe("investigating, identified, monitoring, or resolved; defaults to the incident's current status"),
    id: z.string().optional().describe("Draft id to edit; omit to create a new draft"),
  }),
  outputSchema: updateShape,
  mcpAnnotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  run: async ({ incidentId, body, state, id }, ctx) => {
    await assertAccess("incident", incidentId, "editor");
    const db = getDb();
    const [incident] = await db
      .select({ status: schema.incidents.status, orgId: schema.incidents.orgId })
      .from(schema.incidents)
      .where(eq(schema.incidents.id, incidentId))
      .limit(1);
    if (!incident) fail("Incident not found.", { errorCode: "not_found", statusCode: 404 });
    const now = nowIso();

    if (id) {
      const [row] = await db
        .update(schema.statusUpdates)
        .set({ body: body.trim(), state: state ?? undefined, updatedAt: now })
        .where(
          and(
            eq(schema.statusUpdates.id, id),
            eq(schema.statusUpdates.incidentId, incidentId),
            eq(schema.statusUpdates.published, false),
          ),
        )
        .returning();
      if (!row) fail("Draft not found or already published.", { errorCode: "not_found", statusCode: 404 });
      const { orgId: _o, ...out } = row;
      return out;
    }

    const row = {
      id: newId(),
      incidentId,
      body: body.trim(),
      state: state ?? incident.status,
      published: false,
      publishedAt: null,
      authorEmail: ctx?.userEmail ?? null,
      createdAt: now,
      updatedAt: now,
      orgId: incident.orgId,
    };
    await db.insert(schema.statusUpdates).values(row);
    const { orgId: _o, ...out } = row;
    return out;
  },
});
