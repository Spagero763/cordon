import { defineAction, fail } from "@agent-native/core/action";
import { assertAccess } from "@agent-native/core/sharing";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { serviceShape } from "../server/lib/contracts.js";
import { openIncidentForService } from "../server/lib/incidents.js";

const REPO = /^[\w.-]+\/[\w.-]+$/;

export default defineAction({
  description:
    "Change a monitored service: name, URL, repository, check interval, public visibility, on-call email, or pause and resume checks. Only pass the fields to change.",
  schema: z.object({
    id: z.string().describe("Service id from list-services"),
    name: z.string().min(1).max(80).optional().describe("New name"),
    url: z.string().url().optional().describe("New URL to check"),
    repo: z
      .string()
      .regex(REPO)
      .nullable()
      .optional()
      .describe('GitHub "owner/name", or null to clear'),
    checkIntervalMinutes: z.coerce.number().int().min(1).max(60).optional().describe("Minutes between checks"),
    enabled: z.boolean().optional().describe("false pauses checks, true resumes them"),
    isPublic: z.boolean().optional().describe("Show on the public status page"),
    oncallEmail: z.string().email().nullable().optional().describe("On-call email, or null to clear"),
  }),
  outputSchema: serviceShape,
  run: async ({ id, ...patch }) => {
    await assertAccess("service", id, "editor");
    const changes: Partial<typeof schema.services.$inferInsert> = {};
    if (patch.name !== undefined) changes.name = patch.name.trim();
    if (patch.url !== undefined) {
      if (!/^https?:\/\//.test(patch.url)) {
        fail("URL must start with http:// or https://.", { errorCode: "invalid_url" });
      }
      changes.url = patch.url.trim();
    }
    if (patch.repo !== undefined) changes.repo = patch.repo;
    if (patch.checkIntervalMinutes !== undefined) changes.checkIntervalMinutes = patch.checkIntervalMinutes;
    if (patch.enabled !== undefined) changes.enabled = patch.enabled;
    if (patch.isPublic !== undefined) changes.isPublic = patch.isPublic;
    if (patch.oncallEmail !== undefined) changes.oncallEmail = patch.oncallEmail;
    if (Object.keys(changes).length === 0) {
      fail("Nothing to change.", { errorCode: "empty_patch" });
    }
    const db = getDb();
    const [row] = await db
      .update(schema.services)
      .set(changes)
      .where(eq(schema.services.id, id))
      .returning();
    if (!row) fail("Service not found.", { errorCode: "not_found", statusCode: 404 });
    const open = await openIncidentForService(db, id);
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
    };
  },
});
