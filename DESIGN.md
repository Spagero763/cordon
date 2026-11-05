# Visual Design Contract

Cordon is a control room for small teams that run production without an
on-call department. The screen has to be readable at 3am by someone who was
asleep two minutes ago.

## Product mode

- Mode: `operate`
- Audience and cadence: one to ten engineers, opened rarely and under stress,
  then kept open for hours while an incident runs.
- Primary workflow: see what is broken, what changed, who has it, and what we
  have told customers. Act from the timeline. Hand work to the agent and take
  it back without losing the thread.

## Visual direction

- Direction name: Night desk
- Palette family: ink and graphite neutrals. One signal colour carries state:
  ember (amber-red) while an incident is open, moss green at all clear, slate
  while monitoring. Severity is a stripe and a label, never a filled card.
- Type treatment: sans for everything, tabular figures for times and counts,
  a mono face only for timestamps, URLs, and status codes.
- Composition: list and detail. The board is a vertical stack of services with
  their health and any open incident. The incident page is a single tall
  timeline with a narrow control column; the agent sidebar stays on the right.
- Shape language: hairline borders, 6px corners, no shadows except menus and
  dialogs. Dense rows, generous line height.
- Motion: the room is alive while something is open and calm when it is not.
  The cordon stripe draws across, keeps marching, and retracts at all clear. A
  radar ring beats fast in ember during an incident and slow in moss when
  clear. Open timers roll their digits every second. Pages arrive in a short
  stagger; new timeline rows spring in and glow once; tabs slide a shared
  pill. A wash of colour crosses the page when state changes: ember on open,
  moss on resolve. Uptime bars grow from the baseline. Reduced motion turns
  all of it off except opacity.
- Anti-references: dashboard stat strips, gradient hero panels, glass cards,
  traffic-light grids, robot or sparkle icons for agent work, and anything that
  reads as a status page vendor's marketing site.

## Guardrails

- Keep the scaffold's semantic tokens and the shared chat shell. Cordon only
  recolours the accent and adds its own `--signal` tokens.
- The timeline is the source of truth on screen. Every human and agent action
  appears there before anywhere else.
- Customer-facing text is always shown in a review state before it is
  published. The publish control is deliberately heavier than everything else.
- The public status page is the only surface with its own chrome. It is plain,
  high contrast, and loads without the app shell.
