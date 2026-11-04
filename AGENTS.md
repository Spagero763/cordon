# Cordon Agent Guide

Cordon is an agent-native incident room for small teams. `/incidents` is the board (sign-in lands here), `/incidents/:incidentId` is the war room with the timeline, `/services` manages monitored services, and `/status/:slug` is the public status page. Chat stays at `/chat`; the agent sidebar is open on every domain page.

## Skills

Runtime: `incident-command` (triage, severity, status lifecycle), `customer-updates` (status page wording), `postmortem` (write-up after resolve). Read the one that matches before acting. Development skills live in `.agents/skills/` alongside them; `build-an-app` and `adding-a-feature` cover changes to this app's source.

Use local docs only: `pnpm action docs-search --query "<topic>"` and `pnpm action source-search --query "<pattern>"`.

## Core rules

- Every write action logs its own timeline entry. Do not add a note that repeats it.
- Normal app data flows through actions; AI work stays in chat. Never fabricate a check result, a time, or a cause.
- `publish-update` needs a person's approval for the exact draft. Draft, then ask.
- Only one open incident per service. `run-checks` and `ingest-alert` attach to it instead of opening another.
- Times are ISO 8601 UTC in actions; show the person local time.
- UI feedback within 100 ms; acknowledge before network work.

## Application state

- `navigation` carries `view` (`incidents`, `incident`, `services`, `chat`, `home`), `incidentId` on the war room, `serviceId` when a service drawer is open, and `tab` (`timeline`, `updates`, `postmortem`).
- `selection` (tab-scoped) holds timeline entries the person picked; `view-screen` returns it. When present, treat it as the source for any summary or update they ask for.
- `navigate` opens a view or an incident; use it once when you open an incident they are not looking at.

## Actions

| Action | Purpose |
| --- | --- |
| list-incidents | Open, resolved, or all incidents, newest first |
| get-incident | Full incident with timeline, updates, action items |
| declare-incident | Open an incident (title, severity, serviceId, summary) |
| update-incident | Status, severity, commander, title, postmortem fields; stamps resolvedAt |
| add-note | Timeline note or hypothesis |
| draft-update | Write or edit a customer update draft |
| publish-update | Publish a draft (approval required) |
| add-action-item / update-action-item | Postmortem follow-ups |
| list-services / create-service / update-service | Monitored services, webhook per service |
| run-checks | Ping services now; opens incidents after 2 failures |
| ingest-alert | Record an external alert; groups by fingerprint |
| list-recent-changes | Commits and merged PRs on the service repo in a window |
| get-status-page / update-status-page | Public page read and setup |

Verify a write by reading back with `get-incident` or `list-services` before telling the person it is done.
