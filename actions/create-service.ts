import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { orgOf, requireUser } from "../server/lib/access.js";
import { serviceShape } from "../server/lib/contracts.js";
import { newId, newToken, nowIso } from "../server/lib/ids.js";
import { ensureWatchJob } from "../server/lib/watch-job.js";

const REPO = /^[\w.-]+\/[\w.-]+$/;

export default defineAction({
  description:
    "Add a service to monitor. Cordon pings its URL on the check interval, opens an incident after two consecutive failures, and gives it a webhook URL for external alerts. Visible to the organization when one is active.",
  schema: z.object({
    name: z.string().min(1).max(80).describe('Service name, e.g. "API" or "Marketing site"'),
    url: z.string().url().describe("Public https URL to check, e.g. https://api.example.com/health"),
    repo: z
      .string()
      .regex(REPO)
      .optional()
      .describe('GitHub repository as "owner/name" so recent changes can be listed; omit if none'),
    checkIntervalMinutes: z.coerce
      .number()
      .int()
      .min(1)
      .max(60)
      .default(5)
      .describe("Minutes between checks; defaults to 5"),
    isPublic: z.boolean().default(true).describe("Show on the public status page; defaults to true"),
    oncallEmail: z.string().email().optional().describe("Who is paged for this service; omit if nobody"),
  }),
  outputSchema: serviceShape,
  link: ({ result }) => ({
    url: buildDeepLink({ view: "services", to: "/services", params: { serviceId: result.id } }),
    label: `Open ${result.name}`,
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireUser(ctx);
    const orgId = orgOf(ctx);
    if (!/^https?:\/\//.test(args.url)) {
      fail("URL must start with http:// or https://.", { errorCode: "invalid_url" });
    }
    const row = {
      id: newId(),
      name: args.name.trim(),
      url: args.url.trim(),
      repo: args.repo ?? null,
      checkIntervalMinutes: args.checkIntervalMinutes,
      enabled: true,
      isPublic: args.isPublic,
      webhookToken: newToken(),
      oncallEmail: args.oncallEmail ?? null,
      lastCheckAt: null,
      lastCheckOk: null,
      consecutiveFailures: 0,
      createdAt: nowIso(),
      ownerEmail,
      orgId,
      visibility: orgId ? ("org" as const) : ("private" as const),
    };
    await getDb().insert(schema.services).values(row);
    try {
      await ensureWatchJob(ctx);
    } catch (error) {
      console.warn("[cordon] watch job was not created:", error instanceof Error ? error.message : error);
    }
    const { webhookToken: _token, ownerEmail: _o, orgId: _g, visibility: _v, createdAt: _c, ...out } = row;
    return { ...out, openIncidentId: null };
  },
});
