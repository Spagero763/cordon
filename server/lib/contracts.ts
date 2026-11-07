import { z } from "zod";

import {
  ACTOR_KINDS,
  INCIDENT_SOURCES,
  INCIDENT_STATUSES,
  SEVERITIES,
} from "../../shared/incident.js";

export const severitySchema = z.enum(SEVERITIES);
export const incidentStatusSchema = z.enum(INCIDENT_STATUSES);

export const serviceShape = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  repo: z.string().nullable(),
  checkIntervalMinutes: z.number(),
  enabled: z.boolean(),
  isPublic: z.boolean(),
  oncallEmail: z.string().nullable(),
  lastCheckAt: z.string().nullable(),
  lastCheckOk: z.boolean().nullable(),
  consecutiveFailures: z.number(),
  openIncidentId: z.string().nullable(),
});

export const checkShape = z.object({
  id: z.string(),
  serviceId: z.string(),
  checkedAt: z.string(),
  ok: z.boolean(),
  statusCode: z.number().nullable(),
  latencyMs: z.number().nullable(),
  error: z.string().nullable(),
});

export const entryShape = z.object({
  id: z.string(),
  incidentId: z.string(),
  kind: z.string(),
  body: z.string(),
  actorEmail: z.string().nullable(),
  actorKind: z.enum(ACTOR_KINDS),
  meta: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});

export const updateShape = z.object({
  id: z.string(),
  incidentId: z.string(),
  body: z.string(),
  state: incidentStatusSchema,
  published: z.boolean(),
  publishedAt: z.string().nullable(),
  authorEmail: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const actionItemShape = z.object({
  id: z.string(),
  incidentId: z.string(),
  title: z.string(),
  assigneeEmail: z.string().nullable(),
  dueAt: z.string().nullable(),
  done: z.boolean(),
  createdAt: z.string(),
});

export const incidentShape = z.object({
  id: z.string(),
  title: z.string(),
  severity: severitySchema,
  status: incidentStatusSchema,
  serviceId: z.string().nullable(),
  serviceName: z.string().nullable(),
  commanderEmail: z.string().nullable(),
  source: z.enum(INCIDENT_SOURCES),
  startedAt: z.string(),
  resolvedAt: z.string().nullable(),
  summary: z.string().nullable(),
  impact: z.string().nullable(),
  rootCause: z.string().nullable(),
  lessons: z.string().nullable(),
  updatedAt: z.string(),
});

export const peopleShape = z.record(z.string(), z.string()).describe("Display name by email for everyone referenced");

export const incidentDetailShape = incidentShape.extend({
  timeline: z.array(entryShape),
  updates: z.array(updateShape),
  actionItems: z.array(actionItemShape),
  people: peopleShape,
});
