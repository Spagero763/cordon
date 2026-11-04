import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from "h3";
import { eq } from "drizzle-orm";

import { SEVERITIES, type Severity } from "../../../../shared/incident.js";
import { getDb, schema } from "../../../db/index.js";
import { ingestAlert } from "../../../lib/alerts.js";

const TOKEN = /^[a-f0-9]{48}$/;

function text(value: unknown, max: number): string | null {
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, max);
  if (typeof value === "number") return String(value);
  return null;
}

/**
 * Generic alert intake. Any monitoring tool that can POST JSON can page
 * Cordon: the token in the URL identifies the service, and common field
 * names from Sentry, Grafana, Better Stack and plain curl are recognised.
 */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token") ?? "";
  if (!TOKEN.test(token)) {
    setResponseStatus(event, 404);
    return { ok: false, error: "unknown token" };
  }
  const [service] = await getDb()
    .select()
    .from(schema.services)
    .where(eq(schema.services.webhookToken, token))
    .limit(1);
  if (!service) {
    setResponseStatus(event, 404);
    return { ok: false, error: "unknown token" };
  }

  const raw = (await readBody(event).catch(() => null)) as Record<string, unknown> | null;
  const body = raw && typeof raw === "object" ? raw : {};
  const nested = (body.alert ?? body.event ?? body.data ?? {}) as Record<string, unknown>;
  const title =
    text(body.title, 200) ??
    text(body.message, 200) ??
    text(nested.title, 200) ??
    text(body.alertname, 200) ??
    text(nested.message, 200) ??
    `Alert for ${service.name}`;
  const details =
    text(body.body, 4000) ??
    text(body.description, 4000) ??
    text(nested.description, 4000) ??
    (Object.keys(body).length ? JSON.stringify(body).slice(0, 4000) : null);
  const source = text(body.source, 40) ?? text(body.project, 40) ?? "webhook";
  const fingerprint = text(body.fingerprint, 200) ?? text(body.id, 200) ?? text(nested.id, 200);
  const severityHint = text(body.severity, 10)?.toLowerCase() ?? null;
  const severity: Severity = (SEVERITIES as readonly string[]).includes(severityHint ?? "")
    ? (severityHint as Severity)
    : severityHint === "critical"
      ? "sev1"
      : severityHint === "warning" || severityHint === "minor"
        ? "sev3"
        : "sev2";

  const result = await ingestAlert({
    service,
    source,
    title,
    body: details,
    fingerprint,
    severity,
    actor: { email: null, kind: "webhook" },
    ownerEmail: service.ownerEmail,
    orgId: service.orgId,
  });
  setResponseStatus(event, 202);
  return { ok: true, ...result };
});
