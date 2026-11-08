import type { ActionRunContext } from "@agent-native/core/action";
import { buildJobResourceContent, parseJobResource } from "@agent-native/core/jobs/frontmatter";
import { organizationResourceOwner, resourceGetByPath, resourcePut } from "@agent-native/core/resources/store";
import manageAutomation from "@agent-native/core/triggers/actions/manage-automation";

export const WATCH_RUNNER = "cordon.watch";
export const WATCH_JOB_NAME = "watch-services";
export const TRIAGE_JOB_NAME = "triage-incident";
export const TRIAGE_JOB_PATH = `jobs/${TRIAGE_JOB_NAME}.md`;
const WATCH_JOB_PATH = `jobs/${WATCH_JOB_NAME}.md`;

const WATCH_JOB_BODY = `# Watch the services

Runs every minute as code, no model involved. Each service is probed once its
own interval has elapsed; two failed checks in a row open an incident, a
passing check on a failing service logs the recovery. When an incident opens
this way, the triage-incident automation takes it from there.`;

const TRIAGE_JOB_BODY = `# First two minutes

An incident just opened without a person in the room. Call get-incident with
the incidentId from the event, then follow the incident-command skill's first
two minutes: write what is broken, when it started, and what changed
(list-recent-changes on the service's repository, around the start time) as
notes on that incident. Do not change severity or status. Do not draft a
customer update unless the service is public and the impact is clear; if you
do, leave it as a draft for a person to publish.`;

/**
 * A workspace's two automations, created as the person who added its first
 * service so they run with that person's access: a code job that checks every
 * minute, and the agent run it wakes when a check or an alert opens an incident.
 * Scoped to the organization when there is one, otherwise to that person.
 */
export async function ensureWatchJob(ctx: ActionRunContext | undefined): Promise<void> {
  const email = ctx?.userEmail?.trim().toLowerCase();
  if (!email) return;
  // Jobs created from outside the app (CLI, HTTP, MCP) run with write approval
  // on every step, which unattended work cannot pass. Only the UI and the agent
  // create them; the next check from either will.
  if (ctx?.caller !== "frontend" && ctx?.caller !== "tool") return;
  const orgId = ctx?.orgId?.trim() || null;
  const owner = orgId ? organizationResourceOwner(orgId) : email;
  const scope = orgId ? "organization" : "personal";

  if (!(await resourceGetByPath(owner, WATCH_JOB_PATH))) {
    await manageAutomation.run(
      {
        operation: "create",
        name: WATCH_JOB_NAME,
        scope,
        triggerType: "schedule",
        schedule: "* * * * *",
        body: WATCH_JOB_BODY,
        enabled: true,
      },
      ctx,
    );
  }
  // The create path has no field for a code runner, so point the saved job at
  // ours. This also converts a job created before the runner existed, which
  // ran the model every five minutes to do the same work.
  const saved = await resourceGetByPath(owner, WATCH_JOB_PATH);
  if (saved) {
    const parsed = parseJobResource(saved.content);
    if (parsed.meta.runner !== WATCH_RUNNER) {
      await resourcePut(
        owner,
        WATCH_JOB_PATH,
        buildJobResourceContent(
          { ...parsed.meta, runner: WATCH_RUNNER, mode: "deterministic", schedule: "* * * * *" },
          WATCH_JOB_BODY,
        ),
        "text/markdown",
      );
    }
  }

  if (!(await resourceGetByPath(owner, TRIAGE_JOB_PATH))) {
    await manageAutomation.run(
      {
        operation: "create",
        name: TRIAGE_JOB_NAME,
        scope,
        triggerType: "event",
        event: "incident.opened",
        body: TRIAGE_JOB_BODY,
        enabled: true,
      },
      ctx,
    );
  }
}
