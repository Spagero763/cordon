import { defineAction, fail } from "@agent-native/core/action";
import { and, desc, eq, gt, inArray, or, isNull } from "drizzle-orm";
import { z } from "zod";

import { OPEN_STATUSES } from "../shared/incident.js";
import { getDb, schema } from "../server/db/index.js";
import { recentChecksByService } from "../server/lib/checks.js";
import { incidentStatusSchema, severitySchema } from "../server/lib/contracts.js";

const publicIncident = z.object({
  id: z.string(),
  title: z.string(),
  severity: severitySchema,
  status: incidentStatusSchema,
  serviceName: z.string().nullable(),
  startedAt: z.string(),
  resolvedAt: z.string().nullable(),
  updates: z.array(
    z.object({ id: z.string(), body: z.string(), state: incidentStatusSchema, publishedAt: z.string() }),
  ),
});

export default defineAction({
  description:
    "Read the public status page by slug: title, public services with current health, and incidents that have at least one published update (open ones, plus those resolved in the last 7 days). An incident nobody has published about is not shown. No sign-in required; nothing internal is included.",
  schema: z.object({ slug: z.string().min(1).max(48).describe("Status page slug from the URL /status/<slug>") }),
  outputSchema: z.object({
    title: z.string(),
    slug: z.string(),
    generatedAt: z.string(),
    allClear: z.boolean(),
    services: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        ok: z.boolean().nullable(),
        lastCheckAt: z.string().nullable(),
        checks: z.array(z.object({ ok: z.boolean(), latencyMs: z.number().nullable(), checkedAt: z.string() })),
      }),
    ),
    open: z.array(publicIncident),
    recent: z.array(publicIncident),
  }),
  http: { method: "GET" },
  requiresAuth: false,
  readOnly: true,
  publicAgent: { expose: true, readOnly: true, requiresAuth: false },
  persistInBrowser: false,
  run: async ({ slug }) => {
    const db = getDb();
    const { statusPages, services, incidents, statusUpdates } = schema;
    const [page] = await db
      .select({ id: statusPages.id, slug: statusPages.slug, title: statusPages.title, orgId: statusPages.orgId, ownerEmail: statusPages.ownerEmail })
      .from(statusPages)
      .where(eq(statusPages.slug, slug))
      .limit(1);
    if (!page) fail("Status page not found.", { errorCode: "not_found", statusCode: 404 });

    const tenant = page.orgId
      ? eq(services.orgId, page.orgId)
      : and(isNull(services.orgId), eq(services.ownerEmail, page.ownerEmail));
    const publicServices = await db
      .select({ id: services.id, name: services.name, ok: services.lastCheckOk, lastCheckAt: services.lastCheckAt })
      .from(services)
      .where(and(tenant, eq(services.isPublic, true), eq(services.enabled, true)))
      .orderBy(services.name)
      .limit(100);
    const serviceIds = publicServices.map((s) => s.id);
    const nameById = new Map(publicServices.map((s) => [s.id, s.name]));
    const checksByService = await recentChecksByService(serviceIds, 40);

    const incidentTenant = page.orgId
      ? eq(incidents.orgId, page.orgId)
      : and(isNull(incidents.orgId), eq(incidents.ownerEmail, page.ownerEmail));
    const visibleService = serviceIds.length
      ? or(isNull(incidents.serviceId), inArray(incidents.serviceId, serviceIds))
      : isNull(incidents.serviceId);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const rows = await db
      .select({
        id: incidents.id,
        title: incidents.title,
        severity: incidents.severity,
        status: incidents.status,
        serviceId: incidents.serviceId,
        startedAt: incidents.startedAt,
        resolvedAt: incidents.resolvedAt,
      })
      .from(incidents)
      .where(
        and(
          incidentTenant,
          visibleService,
          or(inArray(incidents.status, [...OPEN_STATUSES]), gt(incidents.resolvedAt, weekAgo)),
        ),
      )
      .orderBy(desc(incidents.startedAt))
      .limit(50);

    const updates = rows.length
      ? await db
          .select({
            id: statusUpdates.id,
            incidentId: statusUpdates.incidentId,
            body: statusUpdates.body,
            state: statusUpdates.state,
            publishedAt: statusUpdates.publishedAt,
          })
          .from(statusUpdates)
          .where(and(inArray(statusUpdates.incidentId, rows.map((r) => r.id)), eq(statusUpdates.published, true)))
          .orderBy(desc(statusUpdates.publishedAt))
          .limit(500)
      : [];
    const updatesByIncident = new Map<string, Array<{ id: string; body: string; state: typeof rows[number]["status"]; publishedAt: string }>>();
    for (const u of updates) {
      if (!u.publishedAt) continue;
      const list = updatesByIncident.get(u.incidentId) ?? [];
      list.push({ id: u.id, body: u.body, state: u.state, publishedAt: u.publishedAt });
      updatesByIncident.set(u.incidentId, list);
    }
    // Customers see an incident only once someone has approved a word about it.
    const shaped = rows.filter((row) => updatesByIncident.has(row.id)).map((row) => ({
      id: row.id,
      title: row.title,
      severity: row.severity,
      status: row.status,
      serviceName: row.serviceId ? (nameById.get(row.serviceId) ?? null) : null,
      startedAt: row.startedAt,
      resolvedAt: row.resolvedAt,
      updates: updatesByIncident.get(row.id) ?? [],
    }));
    const open = shaped.filter((i) => i.status !== "resolved");
    return {
      title: page.title,
      slug: page.slug,
      generatedAt: new Date().toISOString(),
      allClear: open.length === 0 && publicServices.every((s) => s.ok !== false),
      services: publicServices.map((service) => ({
        ...service,
        checks: checksByService.get(service.id) ?? [],
      })),
      open,
      recent: shaped.filter((i) => i.status === "resolved"),
    };
  },
});
