import { defineAction } from "@agent-native/core/action";
import { accessFilter } from "@agent-native/core/sharing";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description: "Read this workspace's public status page settings (slug and title), or null when none has been created.",
  schema: z.object({}),
  outputSchema: z.object({
    page: z.object({ id: z.string(), slug: z.string(), title: z.string() }).nullable(),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async () => {
    const { statusPages, statusPageShares } = schema;
    const [row] = await getDb()
      .select({ id: statusPages.id, slug: statusPages.slug, title: statusPages.title })
      .from(statusPages)
      .where(accessFilter(statusPages, statusPageShares))
      .limit(1);
    return { page: row ?? null };
  },
});
