import { defineAction, fail } from "@agent-native/core/action";
import { writeAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";

export default defineAction({
  description:
    'Move the person\'s screen. Views: "incidents" (the board), "incident" with incidentId (the war room), "services", "chat". Use it once when you open an incident they are not looking at; do not use it for every step.',
  schema: z.object({
    view: z.enum(["incidents", "incident", "services", "chat", "home"]).optional().describe("View to open"),
    incidentId: z.string().optional().describe('Incident id when view is "incident"'),
    path: z.string().optional().describe("Explicit local path, e.g. /incidents/<id>; overrides view"),
    threadId: z.string().optional().describe("Chat thread id to open"),
  }),
  http: false,
  run: async (args) => {
    if (!args.view && !args.path) {
      fail("Pass view or path.", { errorCode: "invalid_navigation" });
    }
    const nav: Record<string, string> = {};
    if (args.view) nav.view = args.view;
    if (args.incidentId) {
      nav.incidentId = args.incidentId;
      if (!args.path) nav.path = `/incidents/${encodeURIComponent(args.incidentId)}`;
    }
    if (args.path) nav.path = args.path;
    if (args.threadId) nav.threadId = args.threadId;
    nav._writeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await writeAppStateForCurrentTab("navigate", nav);
    return { message: `Navigating to ${nav.path ?? args.view}` };
  },
});
