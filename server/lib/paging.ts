import { getAppProductionUrl, isEmailConfigured, renderEmail, sendEmail } from "@agent-native/core/server";
import { eq } from "drizzle-orm";

import { SEVERITY_LABEL } from "../../shared/incident.js";
import { getDb, schema } from "../db/index.js";
import { insertEntry } from "./incidents.js";

/**
 * Tell the service's on-call person a new incident is open. Runs after the
 * opening transaction commits, so a slow mail provider never holds a lock.
 * Quiet when the service has nobody on call or the deployment cannot send mail.
 */
export async function pageOnCall(incidentId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({
      id: schema.incidents.id,
      title: schema.incidents.title,
      severity: schema.incidents.severity,
      orgId: schema.incidents.orgId,
      serviceName: schema.services.name,
      oncallEmail: schema.services.oncallEmail,
    })
    .from(schema.incidents)
    .innerJoin(schema.services, eq(schema.services.id, schema.incidents.serviceId))
    .where(eq(schema.incidents.id, incidentId))
    .limit(1);
  if (!row?.oncallEmail) return;
  if (!(await isEmailConfigured())) return;

  const url = `${getAppProductionUrl()}/incidents/${encodeURIComponent(row.id)}`;
  const severity = SEVERITY_LABEL[row.severity];
  const { html, text } = renderEmail({
    preheader: `${row.serviceName}: ${row.title}`,
    heading: `${row.severity.toUpperCase()} on ${row.serviceName}`,
    paragraphs: [
      row.title,
      `Opened just now as ${severity.toLowerCase()}. You are on call for ${row.serviceName}. The timeline has what is known so far.`,
    ],
    cta: { label: "Open the incident", url },
  });

  try {
    const sent = await sendEmail({
      to: row.oncallEmail,
      subject: `[${row.severity.toUpperCase()}] ${row.serviceName}: ${row.title}`,
      html,
      text,
      disableClickTracking: true,
    });
    if (sent.status !== "sent") return;
  } catch (error) {
    console.warn("[cordon] page was not sent:", error instanceof Error ? error.message : error);
    return;
  }
  await insertEntry(db, {
    incidentId: row.id,
    kind: "paged",
    body: `Paged ${row.oncallEmail}`,
    actor: { email: null, kind: "monitor" },
    orgId: row.orgId,
    meta: { to: row.oncallEmail },
  });
}
