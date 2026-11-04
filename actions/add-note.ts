import { defineAction, fail } from "@agent-native/core/action";
import { assertAccess } from "@agent-native/core/sharing";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { actorFromCtx } from "../server/lib/access.js";
import { entryShape } from "../server/lib/contracts.js";
import { insertEntry, parseMeta, touchIncident } from "../server/lib/incidents.js";

export default defineAction({
  description:
    'Add a timeline entry to an incident. kind "note" for a fact or an action taken, "hypothesis" for a suspected cause not yet confirmed. Keep it under 240 characters, facts first, times in UTC.',
  schema: z.object({
    incidentId: z.string().describe("Incident id"),
    body: z.string().min(1).max(1000).describe("The entry text"),
    kind: z.enum(["note", "hypothesis"]).default("note").describe('"note" or "hypothesis"; defaults to "note"'),
  }),
  outputSchema: entryShape,
  mcpAnnotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  run: async ({ incidentId, body, kind }, ctx) => {
    await assertAccess("incident", incidentId, "editor");
    const db = getDb();
    const [incident] = await db
      .select({ orgId: schema.incidents.orgId })
      .from(schema.incidents)
      .where(eq(schema.incidents.id, incidentId))
      .limit(1);
    if (!incident) fail("Incident not found.", { errorCode: "not_found", statusCode: 404 });
    const entry = await db.transaction(async (tx) => {
      const row = await insertEntry(tx, {
        incidentId,
        kind,
        body: body.trim(),
        actor: actorFromCtx(ctx),
        orgId: incident.orgId,
      });
      await touchIncident(tx, incidentId);
      return row;
    });
    const { orgId: _o, meta, ...out } = entry;
    return { ...out, meta: parseMeta(meta) };
  },
});
