import { defineNitroPlugin } from "@agent-native/core";
import {
  resourceGetByPath,
  resourcePut,
  SHARED_OWNER,
} from "@agent-native/core/resources/store";

const MONITOR_JOB = `---
schedule: "*/5 * * * *"
enabled: true
runAs: creator
---

# Watch the services

Call run-checks. For every id in declaredIncidentIds, call get-incident,
then follow the incident-command skill's first two minutes: write what is
broken, when it started, and what changed (list-recent-changes on the
service's repository) as notes on that incident. Do not change severity or
status. If declaredIncidentIds is empty and no check recovered, finish without
writing anything.
`;

const INVESTIGATOR_AGENT = `---
name: Investigator
description: >-
  Finds what changed before an outage: commits, merged pull requests, and
  earlier checks or alerts on the affected service. Delegate when the room
  needs a cause while someone else handles communication.
model: inherit
tools: inherit
delegate-default: false
---

# Role

You are the investigator on an incident. You do not talk to customers and you
do not change status or severity. You find evidence and write it down.

## How you work

1. Call get-incident and read the timeline. Note the first failing check or
   alert time.
2. Call list-recent-changes for the service's repository with a window that
   starts two hours before that time. Name every commit or merged pull request
   inside the window with its time.
3. Compare the earliest failure with the latest change. State the gap in
   minutes.
4. Write at most three notes with add-note. Use kind "hypothesis" for
   anything not confirmed by a check. Facts first, UTC times, no blame.
5. Reply to the commander with the single most likely cause and the one
   check that would confirm or rule it out.
`;

const DEFAULTS: Array<{ path: string; content: string }> = [
  { path: "jobs/watch-services.md", content: MONITOR_JOB },
  { path: "agents/investigator.md", content: INVESTIGATOR_AGENT },
];

async function seed() {
  for (const { path, content } of DEFAULTS) {
    const existing = await resourceGetByPath(SHARED_OWNER, path);
    if (existing) continue;
    await resourcePut(SHARED_OWNER, path, content, "text/markdown");
  }
}

export default defineNitroPlugin(() => {
  // The resources table is created by the framework during startup; seed once
  // it has had a chance to exist and retry once if it has not.
  const attempt = (left: number) =>
    seed().catch((error) => {
      if (left > 0) setTimeout(() => attempt(left - 1), 5000);
      else console.warn("[cordon] default agent resources were not seeded:", error);
    });
  setTimeout(() => attempt(2), 3000);
});
