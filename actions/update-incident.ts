import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { assertAccess } from "@agent-native/core/sharing";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { SEVERITY_LABEL, STATUS_LABEL } from "../shared/incident.js";
import { getDb, schema } from "../server/db/index.js";
import { actorFromCtx } from "../server/lib/access.js";
import { INCIDENT_CARD_RENDERER, incidentCard, incidentShape, incidentStatusSchema, severitySchema } from "../server/lib/contracts.js";
import { incidentSummary, serviceNameOf } from "../server/lib/incident-reads.js";
import { insertEntry } from "../server/lib/incidents.js";
import { nowIso } from "../server/lib/ids.js";

export default defineAction({
  description:
    "Change an incident: status, severity, commander, title, or the postmortem fields (summary, impact, rootCause, lessons). Pass only what changes. Every change is logged on the timeline; add a short reason so the log reads well. Setting status to resolved stamps resolvedAt; moving a resolved incident back reopens it.",
  schema: z.object({
    id: z.string().describe("Incident id"),
    status: incidentStatusSchema.optional().describe("investigating, identified, monitoring, or resolved"),
    severity: severitySchema.optional().describe("sev1 to sev4"),
    commanderEmail: z.string().email().nullable().optional().describe("Who runs the incident, or null to clear"),
    title: z.string().min(3).max(140).optional().describe("New title"),
    summary: z.string().max(4000).nullable().optional().describe("Postmortem summary"),
    impact: z.string().max(4000).nullable().optional().describe("Postmortem impact"),
    rootCause: z.string().max(8000).nullable().optional().describe("Postmortem root cause and contributing factors"),
    lessons: z.string().max(4000).nullable().optional().describe("Postmortem lessons"),
    reason: z.string().max(240).optional().describe("Why, in one line; appended to the timeline entry"),
  }),
  outputSchema: incidentShape,
  chatUI: { renderer: INCIDENT_CARD_RENDERER, projectResult: (_args, result) => incidentCard(result) },
  mcpAnnotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "incident",
      to: `/incidents/${encodeURIComponent(args.id)}`,
      params: { incidentId: args.id },
    }),
    label: "Open incident",
  }),
  run: async ({ id, reason, ...patch }, ctx) => {
    await assertAccess("incident", id, "editor");
    const actor = actorFromCtx(ctx);
    const db = getDb();
    const suffix = reason ? ` (${reason.trim()})` : "";

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(schema.incidents)
        .where(eq(schema.incidents.id, id))
        .for("update");
      if (!current) fail("Incident not found.", { errorCode: "not_found", statusCode: 404 });

      const changes: Partial<typeof schema.incidents.$inferInsert> = {};
      const entries: Array<{ kind: "status" | "severity" | "commander" | "resolved" | "reopened" | "note"; body: string; meta?: Record<string, unknown> }> = [];

      if (patch.status !== undefined && patch.status !== current.status) {
        changes.status = patch.status;
        if (patch.status === "resolved") {
          changes.resolvedAt = nowIso();
          entries.push({ kind: "resolved", body: `Resolved${suffix}`, meta: { from: current.status } });
        } else if (current.status === "resolved") {
          changes.resolvedAt = null;
          entries.push({ kind: "reopened", body: `Reopened as ${STATUS_LABEL[patch.status]}${suffix}`, meta: { to: patch.status } });
        } else {
          entries.push({ kind: "status", body: `${STATUS_LABEL[current.status]} → ${STATUS_LABEL[patch.status]}${suffix}`, meta: { from: current.status, to: patch.status } });
        }
      }
      if (patch.severity !== undefined && patch.severity !== current.severity) {
        changes.severity = patch.severity;
        entries.push({
          kind: "severity",
          body: `Severity ${current.severity.toUpperCase()} → ${patch.severity.toUpperCase()} (${SEVERITY_LABEL[patch.severity]})${suffix}`,
          meta: { from: current.severity, to: patch.severity },
        });
      }
      if (patch.commanderEmail !== undefined && patch.commanderEmail !== current.commanderEmail) {
        changes.commanderEmail = patch.commanderEmail;
        entries.push({
          kind: "commander",
          body: patch.commanderEmail ? `${patch.commanderEmail} is commander${suffix}` : `Commander cleared${suffix}`,
          meta: { commanderEmail: patch.commanderEmail },
        });
      }
      if (patch.title !== undefined && patch.title.trim() !== current.title) {
        changes.title = patch.title.trim();
        entries.push({ kind: "note", body: `Title changed to "${changes.title}"${suffix}` });
      }
      const postmortemFields: Array<"summary" | "impact" | "rootCause" | "lessons"> = [];
      for (const field of ["summary", "impact", "rootCause", "lessons"] as const) {
        if (patch[field] !== undefined && patch[field] !== current[field]) {
          changes[field] = patch[field];
          postmortemFields.push(field);
        }
      }
      if (postmortemFields.length) {
        entries.push({ kind: "note", body: `Postmortem updated: ${postmortemFields.join(", ")}${suffix}` });
      }

      if (Object.keys(changes).length === 0) {
        return current;
      }
      changes.updatedAt = nowIso();
      const [row] = await tx
        .update(schema.incidents)
        .set(changes)
        .where(eq(schema.incidents.id, id))
        .returning();
      if (!row) fail("Incident not found.", { errorCode: "not_found", statusCode: 404 });
      for (const entry of entries) {
        await insertEntry(tx, { incidentId: id, kind: entry.kind, body: entry.body, actor, orgId: current.orgId, meta: entry.meta });
      }
      return row;
    });

    return incidentSummary(updated, await serviceNameOf(updated.serviceId));
  },
});
