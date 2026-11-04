---
name: postmortem
description: >-
  How to write the postmortem for a resolved incident from its timeline. Use
  when asked for a postmortem, retro, write-up, root cause, or lessons, and
  before filling summary, impact, rootCause, or lessons with update-incident.
scope: runtime
---

# Postmortem

The timeline is the evidence. The postmortem is the argument. Write it only
after the incident is `resolved` and the commander asks for it.

## Steps

1. Call `get-incident` and read every timeline entry in order.
2. Fill four fields with one `update-incident` call:
   - `summary`: two sentences. What happened and how it ended.
   - `impact`: who was affected, how, and for how long. Use the first failing
     check or alert and the resolution time. Give the window in UTC.
   - `rootCause`: the technical cause and the contributing factors, as
     separate short paragraphs. Name the change that introduced it if the
     timeline shows one. Describe the mechanism, not the person.
   - `lessons`: what went well, what was slow, and what was lucky. Three short
     bullets, each a sentence.
3. Turn each "what was slow" and "what was lucky" into an action item with
   `add-action-item`. One item, one verb, one owner if the timeline names one.
   Leave the owner empty rather than guessing.
4. Tell the commander what you wrote and which action items have no owner.

## Rules

- Blameless. No names in `rootCause` or `lessons`. The timeline keeps the
  record of who did what; the postmortem explains why the system allowed it.
- Every claim traces to a timeline entry. If the entry is a `hypothesis` that
  was never confirmed, say it was not confirmed.
- Detection time, response time, and resolution time are three different
  numbers. Report all three.
- Do not invent action items that the incident did not surface. Fewer items
  that get done beat a wish list.
