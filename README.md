# Cordon

Incident response for teams that do not have an on-call department.

Cordon watches your services, opens an incident when something breaks, and
gives everyone in the room, people and the agent alike, one timeline to work
from. Customer updates are drafted next to the evidence and published only when
a person approves them. When it is over, the postmortem is written from the
same timeline.

## What it does

- **Watch.** Add a URL. Cordon checks it on an interval and opens an incident
  after two failures in a row. Every service also gets a webhook that accepts
  JSON from Sentry, Grafana, Better Stack, or `curl`.
- **Run the room.** Severity, status, commander, notes, and hypotheses live on
  one timeline. The agent reads what you are looking at, pulls recent commits
  and merged pull requests for the service, and logs what it finds beside your
  own notes.
- **Tell customers.** Drafts are written in the room. Publishing asks a person
  to approve the exact text, then posts it to the public status page.
- **Learn.** Summary, impact, root cause, lessons, and action items on every
  incident, written from the timeline rather than from memory.

## Run it

Node 22.22 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open the printed URL, choose **Continue as local dev**, and add a service.
To let the built-in agent answer, connect a model under Settings.

## Deploy

Cordon runs on Netlify, Vercel, Cloudflare Workers, Docker, or any Node host.
Scheduled checks need a host with a scheduler (Netlify, Vercel, Cloudflare, or
a long-lived Node process).

Required environment:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | A persistent PostgreSQL database |
| `BETTER_AUTH_SECRET` | Signs sessions; keep it stable across deploys |

Run `pnpm migrate:production` against the database before the first visit
and after every upgrade.

## Connect other tools

Every Cordon action is reachable over MCP at `/mcp`. Point Cursor, Codex,
or any MCP client at your deployment and it can read the open incident, post
timeline notes, and draft updates with your permissions.

Alerts from monitoring tools go to each service's webhook URL, shown in the
service drawer.
