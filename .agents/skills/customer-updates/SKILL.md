---
name: customer-updates
description: >-
  How to write status page updates for customers during an incident. Use when
  asked to draft, rewrite, shorten, or schedule a customer update, a status
  message, or an all clear, and before calling draft-update.
scope: runtime
---

# Customer updates

An update tells someone who is not in the room three things: what is affected,
what we are doing, and when they will hear from us again. It is never a
changelog of the investigation.

## Shape

Three short sentences, in this order, no headings:

1. Impact as the customer sees it. Name the feature, not the service or the
   host. "Checkout is failing for some customers paying by card."
2. What we are doing, in plain words. "We have identified a bad deploy and are
   rolling it back."
3. The next update. Either a time ("Next update by 14:30 UTC") or a condition
   ("We will post again once the rollback completes").

Resolved updates replace sentence three with the all clear and the window:
"This was resolved at 14:12 UTC. Card payments were affected between 13:41 and
14:12 UTC."

## When to draft the first one

The public page shows an incident only after its first update is published, so
until then customers see service health and nothing else. Offer a first draft
as soon as impact is known for a public service; the person decides whether it
goes out.

## Rules

- Match `state` to the incident status: `investigating`, `identified`,
  `monitoring`, or `resolved`.
- Use the first failing check or alert time from the timeline as the start of
  impact. Never guess a start time.
- No internal names, hostnames, error codes, commit hashes, or people.
- No apologies in the first update. One sentence of apology in the resolved
  update is enough.
- No promises about root cause or prevention until the postmortem is done.
- Under 60 words. If it needs more, it is two updates.
- Draft with `draft-update`. The commander publishes with `publish-update`,
  which asks them to approve the exact text. Do not call `publish-update`
  unless the person explicitly tells you to publish and the approval prompt
  will reach them.

## Cadence

Sev1 every 30 minutes and sev2 every 60 minutes, even when nothing changed.
"We are still investigating; next update by 15:00 UTC" is a valid update.
