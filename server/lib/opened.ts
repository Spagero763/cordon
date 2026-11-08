import { emitAsync } from "@agent-native/core/event-bus";
import { parseJobResource } from "@agent-native/core/jobs/frontmatter";
import { organizationResourceOwner, resourceGetByPath } from "@agent-native/core/resources/store";
import { eq } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import { pageOnCall } from "./paging.js";
import { TRIAGE_JOB_PATH } from "./watch-job.js";

export const INCIDENT_OPENED = "incident.opened";

/**
 * Everything that happens once a new incident is committed: page whoever is
 * on call, and wake the workspace's triage automation when nobody was in the
 * room to open it (monitor and alert sources). A person who declares by hand
 * keeps the Triage button.
 */
export async function afterIncidentOpened(incidentId: string): Promise<void> {
  await pageOnCall(incidentId);
  const [row] = await getDb()
    .select({
      id: schema.incidents.id,
      title: schema.incidents.title,
      severity: schema.incidents.severity,
      source: schema.incidents.source,
      serviceId: schema.incidents.serviceId,
      ownerEmail: schema.incidents.ownerEmail,
      orgId: schema.incidents.orgId,
    })
    .from(schema.incidents)
    .where(eq(schema.incidents.id, incidentId))
    .limit(1);
  if (!row || row.source === "manual") return;

  const owner = row.orgId ? organizationResourceOwner(row.orgId) : row.ownerEmail;
  const job = await resourceGetByPath(owner, TRIAGE_JOB_PATH);
  if (!job) return;
  const createdBy = parseJobResource(job.content).meta.createdBy?.trim().toLowerCase();
  if (!createdBy) return;
  await emitAsync(
    INCIDENT_OPENED,
    { incidentId: row.id, title: row.title, severity: row.severity, source: row.source, serviceId: row.serviceId },
    { owner: createdBy },
  );
}
