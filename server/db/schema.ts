import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";
import {
  createSharesTable,
  ownableColumns,
} from "@agent-native/core/db/schema";

export const services = pgTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  repo: text("repo"),
  checkIntervalMinutes: integer("check_interval_minutes").notNull().default(5),
  enabled: boolean("enabled").notNull().default(true),
  isPublic: boolean("is_public").notNull().default(true),
  webhookToken: text("webhook_token").notNull(),
  oncallEmail: text("oncall_email"),
  lastCheckAt: text("last_check_at"),
  lastCheckOk: boolean("last_check_ok"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  createdAt: text("created_at").notNull(),
  ...ownableColumns(),
});
export const serviceShares = createSharesTable("service_shares");

export const checks = pgTable("checks", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull(),
  checkedAt: text("checked_at").notNull(),
  ok: boolean("ok").notNull(),
  statusCode: integer("status_code"),
  latencyMs: integer("latency_ms"),
  error: text("error"),
  orgId: text("org_id"),
});

export const incidents = pgTable("incidents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  severity: text("severity", { enum: ["sev1", "sev2", "sev3", "sev4"] })
    .notNull()
    .default("sev3"),
  status: text("status", {
    enum: ["investigating", "identified", "monitoring", "resolved"],
  })
    .notNull()
    .default("investigating"),
  serviceId: text("service_id"),
  commanderEmail: text("commander_email"),
  source: text("source", { enum: ["manual", "monitor", "alert"] })
    .notNull()
    .default("manual"),
  startedAt: text("started_at").notNull(),
  resolvedAt: text("resolved_at"),
  summary: text("summary"),
  impact: text("impact"),
  rootCause: text("root_cause"),
  lessons: text("lessons"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  ...ownableColumns(),
});
export const incidentShares = createSharesTable("incident_shares");

export const timelineEntries = pgTable("timeline_entries", {
  id: text("id").primaryKey(),
  incidentId: text("incident_id").notNull(),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  actorEmail: text("actor_email"),
  actorKind: text("actor_kind", {
    enum: ["person", "agent", "monitor", "webhook"],
  })
    .notNull()
    .default("person"),
  meta: text("meta"),
  createdAt: text("created_at").notNull(),
  orgId: text("org_id"),
});

export const statusUpdates = pgTable("status_updates", {
  id: text("id").primaryKey(),
  incidentId: text("incident_id").notNull(),
  body: text("body").notNull(),
  state: text("state", {
    enum: ["investigating", "identified", "monitoring", "resolved"],
  }).notNull(),
  published: boolean("published").notNull().default(false),
  publishedAt: text("published_at"),
  authorEmail: text("author_email"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  orgId: text("org_id"),
});

export const actionItems = pgTable("action_items", {
  id: text("id").primaryKey(),
  incidentId: text("incident_id").notNull(),
  title: text("title").notNull(),
  assigneeEmail: text("assignee_email"),
  dueAt: text("due_at"),
  done: boolean("done").notNull().default(false),
  createdAt: text("created_at").notNull(),
  orgId: text("org_id"),
});

export const alerts = pgTable("alerts", {
  id: text("id").primaryKey(),
  serviceId: text("service_id"),
  incidentId: text("incident_id"),
  source: text("source").notNull(),
  fingerprint: text("fingerprint").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  receivedAt: text("received_at").notNull(),
  orgId: text("org_id"),
});

export const statusPages = pgTable("status_pages", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  createdAt: text("created_at").notNull(),
  ...ownableColumns(),
});
export const statusPageShares = createSharesTable("status_page_shares");
