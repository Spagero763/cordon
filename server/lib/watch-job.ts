import type { ActionRunContext } from "@agent-native/core/action";
import { organizationResourceOwner, resourceGetByPath } from "@agent-native/core/resources/store";
import manageAutomation from "@agent-native/core/triggers/actions/manage-automation";

export const WATCH_JOB_NAME = "watch-services";
const WATCH_JOB_PATH = `jobs/${WATCH_JOB_NAME}.md`;

const WATCH_JOB_BODY = `# Watch the services

Call run-checks. For every id in declaredIncidentIds, call get-incident,
then follow the incident-command skill's first two minutes: write what is
broken, when it started, and what changed (list-recent-changes on the
service's repository) as notes on that incident. Do not change severity or
status. If declaredIncidentIds is empty and no check recovered, finish without
writing anything.`;

/**
 * A workspace's watch job runs as the person who added its first service, so
 * the scheduled checks see the same services that person does. Scoped to the
 * organization when there is one, otherwise to that person.
 */
export async function ensureWatchJob(ctx: ActionRunContext | undefined): Promise<void> {
  const email = ctx?.userEmail?.trim().toLowerCase();
  if (!email) return;
  // Jobs created from outside the app (CLI, HTTP, MCP) run with write approval
  // on every step, which a watcher cannot work under. Only the UI and the agent
  // create it; the next check from either will.
  if (ctx?.caller !== "frontend" && ctx?.caller !== "tool") return;
  const orgId = ctx?.orgId?.trim() || null;
  const owner = orgId ? organizationResourceOwner(orgId) : email;
  if (await resourceGetByPath(owner, WATCH_JOB_PATH)) return;
  await manageAutomation.run(
    {
      operation: "create",
      name: WATCH_JOB_NAME,
      scope: orgId ? "organization" : "personal",
      triggerType: "schedule",
      schedule: "*/5 * * * *",
      body: WATCH_JOB_BODY,
      enabled: true,
    },
    ctx,
  );
}
