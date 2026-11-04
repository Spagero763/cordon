import { createGetDb } from "@agent-native/core/db";
import { registerIdentityColumns } from "@agent-native/core/org";
import { registerShareableResource } from "@agent-native/core/sharing";

import * as schema from "./schema.js";

export const getDb = createGetDb(schema);
export { schema };

registerShareableResource({
  type: "service",
  resourceTable: schema.services,
  sharesTable: schema.serviceShares,
  displayName: "Service",
  titleColumn: "name",
  getResourcePath: (service) => `/services/${service.id}`,
  getDb,
});

registerShareableResource({
  type: "incident",
  resourceTable: schema.incidents,
  sharesTable: schema.incidentShares,
  displayName: "Incident",
  titleColumn: "title",
  getResourcePath: (incident) => `/incidents/${incident.id}`,
  agentRead: { actions: ["get-incident"] },
  getDb,
});

registerShareableResource({
  type: "status-page",
  resourceTable: schema.statusPages,
  sharesTable: schema.statusPageShares,
  displayName: "Status page",
  titleColumn: "title",
  getResourcePath: (page) => `/status/${page.slug}`,
  getDb,
});

const orgScope = {
  column: "incident_id",
  references: { table: "incidents", column: "id", orgColumn: "org_id" },
} as const;

registerIdentityColumns([
  {
    table: "services",
    column: "oncall_email",
    emailChange: "rekey",
    offboard: "retain",
    reason: "Who is paged for the service; attribution only.",
  },
  {
    table: "incidents",
    column: "commander_email",
    emailChange: "rekey",
    offboard: "retain",
    reason: "Historical record of who ran the incident.",
  },
  {
    table: "timeline_entries",
    column: "actor_email",
    emailChange: "rekey",
    offboard: "retain",
    orgScope,
    reason: "Attribution of timeline entries.",
  },
  {
    table: "status_updates",
    column: "author_email",
    emailChange: "rekey",
    offboard: "retain",
    orgScope,
    reason: "Attribution of customer updates.",
  },
  {
    table: "action_items",
    column: "assignee_email",
    emailChange: "rekey",
    offboard: "retain",
    orgScope,
    reason: "Follow-up owner shown on the postmortem.",
  },
]);
