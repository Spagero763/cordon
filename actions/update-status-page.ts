import { defineAction, fail } from "@agent-native/core/action";
import { accessFilter } from "@agent-native/core/sharing";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { slugify } from "../shared/incident.js";
import { getDb, schema } from "../server/db/index.js";
import { orgOf, requireUser } from "../server/lib/access.js";
import { newId, nowIso } from "../server/lib/ids.js";

const pageShape = z.object({ id: z.string(), slug: z.string(), title: z.string() });

export default defineAction({
  description:
    "Create or rename the public status page for this workspace. The page lives at /status/<slug> and lists public services, open incidents, and published updates. One page per workspace.",
  schema: z.object({
    title: z.string().min(1).max(80).describe('Page title, usually the product name, e.g. "Acme status"'),
    slug: z.string().min(2).max(48).optional().describe("URL slug; defaults to a slug of the title"),
  }),
  outputSchema: pageShape,
  mcpAnnotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  run: async ({ title, slug }, ctx) => {
    const ownerEmail = requireUser(ctx);
    const orgId = orgOf(ctx);
    const db = getDb();
    const { statusPages, statusPageShares } = schema;
    const wanted = slugify(slug ?? title);
    if (wanted.length < 2) fail("Slug must contain letters or numbers.", { errorCode: "invalid_slug" });

    const [taken] = await db
      .select({ id: statusPages.id })
      .from(statusPages)
      .where(eq(statusPages.slug, wanted))
      .limit(1);
    const [existing] = await db
      .select()
      .from(statusPages)
      .where(accessFilter(statusPages, statusPageShares))
      .limit(1);
    if (taken && taken.id !== existing?.id) {
      fail(`The slug "${wanted}" is already in use.`, { errorCode: "slug_taken", statusCode: 409 });
    }

    if (existing) {
      const [row] = await db
        .update(statusPages)
        .set({ title: title.trim(), slug: wanted })
        .where(eq(statusPages.id, existing.id))
        .returning({ id: statusPages.id, slug: statusPages.slug, title: statusPages.title });
      if (!row) fail("Status page not found.", { errorCode: "not_found", statusCode: 404 });
      return row;
    }
    const row = {
      id: newId(),
      slug: wanted,
      title: title.trim(),
      createdAt: nowIso(),
      ownerEmail,
      orgId,
      visibility: orgId ? ("org" as const) : ("private" as const),
    };
    await db.insert(statusPages).values(row);
    return { id: row.id, slug: row.slug, title: row.title };
  },
});
