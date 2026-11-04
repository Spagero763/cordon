# Changelog

## 0.1.0

- Services with URL checks. Two failed checks in a row open an incident; a recovery is logged on it.
- Per-service alert webhook that accepts JSON from Sentry, Grafana, Better Stack, or curl and groups repeats by fingerprint.
- Incident room with a shared timeline for people, the agent, monitors, and webhooks.
- Customer updates drafted in the room and published only after a person approves the exact text.
- Public status page at `/status/<slug>` with public services, open incidents, and the last seven days.
- Postmortem fields and action items on every incident.
- Recent commits and merged pull requests for a service's repository, for triage.
- Agent skills for incident command, customer updates, and postmortems, plus an investigator sub-agent and a scheduled watch job.
