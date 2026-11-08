import { ssrfSafeFetch } from "@agent-native/core/extensions/url-safety";
import { desc, inArray } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import { probe, recordCheck } from "./incidents.js";

export interface CheckPoint {
  ok: boolean;
  latencyMs: number | null;
  checkedAt: string;
}

/** Newest first, at most `per` checks for each service the caller may already see. */
export async function recentChecksByService(serviceIds: string[], per = 24) {
  const byService = new Map<string, CheckPoint[]>();
  if (serviceIds.length === 0) return byService;
  const rows = await getDb()
    .select({
      serviceId: schema.checks.serviceId,
      ok: schema.checks.ok,
      latencyMs: schema.checks.latencyMs,
      checkedAt: schema.checks.checkedAt,
    })
    .from(schema.checks)
    .where(inArray(schema.checks.serviceId, serviceIds))
    .orderBy(desc(schema.checks.checkedAt))
    .limit(Math.min(2400, serviceIds.length * per * 2));
  for (const row of rows) {
    const list = byService.get(row.serviceId) ?? [];
    if (list.length < per) {
      list.push({ ok: row.ok, latencyMs: row.latencyMs, checkedAt: row.checkedAt });
      byService.set(row.serviceId, list);
    }
  }
  return byService;
}

type ServiceRow = typeof schema.services.$inferSelect;

/**
 * Probe the services whose interval has elapsed (or all of them when forced),
 * record each result, and report what opened or recovered. Shared by the
 * run-checks action and the per-minute watch runner.
 */
export async function checkServices(rows: ServiceRow[], options: { force?: boolean; signal?: AbortSignal } = {}) {
  const now = Date.now();
  const due = rows.filter((service) => {
    if (options.force || !service.lastCheckAt) return true;
    const elapsed = now - Date.parse(service.lastCheckAt);
    return elapsed >= service.checkIntervalMinutes * 60_000 - 5_000;
  });
  const results = await Promise.all(
    due.map(async (service) => {
      if (options.signal?.aborted) return null;
      const outcome = await probe(service.url, (url, init) => ssrfSafeFetch(url, init));
      const recorded = await recordCheck(service, outcome);
      return {
        ...recorded.check,
        serviceName: service.name,
        incidentId: recorded.incidentId,
        declared: recorded.declared,
        recovered: recorded.recovered,
      };
    }),
  );
  const checks = results.filter((r): r is NonNullable<typeof r> => r !== null);
  return {
    checks: checks.map(({ orgId: _org, ...check }) => check),
    skipped: rows.length - due.length,
    declaredIncidentIds: checks.filter((r) => r.declared && r.incidentId).map((r) => r.incidentId as string),
  };
}
