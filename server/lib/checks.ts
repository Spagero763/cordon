import { desc, inArray } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";

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
