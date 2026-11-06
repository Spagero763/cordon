import { defineAction, fail } from "@agent-native/core/action";
import { resolveSecretDetailed } from "@agent-native/core/server";
import { accessFilter } from "@agent-native/core/sharing";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { GITHUB_TOKEN_KEY } from "../server/lib/github.js";

const REPO = /^[\w.-]+\/[\w.-]+$/;

const changeShape = z.object({
  kind: z.enum(["commit", "pull"]),
  id: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  at: z.string(),
  url: z.string(),
  minutesBeforeAround: z.number().nullable(),
});

export default defineAction({
  description:
    'List commits and merged pull requests on a service\'s GitHub repository inside a time window, newest first. For triage pass around = the incident\'s startedAt: the window then runs from `hours` before that moment to one hour after it, and each change reports minutesBeforeAround (negative means it landed after). Without around, the window is the last `hours` up to now. Works on public repositories without a token; private ones need the GitHub token in Settings.',
  schema: z.object({
    serviceId: z.string().optional().describe("Service id; its configured repository is used"),
    repo: z.string().regex(REPO).optional().describe('GitHub "owner/name"; used when no serviceId is given'),
    around: z
      .string()
      .datetime({ offset: true })
      .optional()
      .describe("ISO 8601 time with offset to centre the window on, usually the incident startedAt; omit for a window ending now"),
    hours: z.coerce.number().int().min(1).max(168).default(24).describe("Hours before `around` (or before now) to include; defaults to 24. Use 3 for triage."),
  }),
  outputSchema: z.object({
    repo: z.string(),
    since: z.string(),
    until: z.string(),
    changes: z.array(changeShape),
    truncated: z.boolean(),
    authenticated: z.boolean(),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ serviceId, repo, around, hours }) => {
    let target = repo ?? null;
    if (serviceId) {
      const [service] = await getDb()
        .select({ repo: schema.services.repo })
        .from(schema.services)
        .where(and(eq(schema.services.id, serviceId), accessFilter(schema.services, schema.serviceShares)))
        .limit(1);
      if (!service) fail("Service not found.", { errorCode: "not_found", statusCode: 404 });
      target = service.repo;
    }
    if (!target) {
      fail("No repository configured for this service. Set repo with update-service first.", { errorCode: "no_repo" });
    }

    const secret = await resolveSecretDetailed(GITHUB_TOKEN_KEY);
    if (secret.lookupFailed) {
      fail("Could not read the GitHub token right now. Try again.", { errorCode: "secret_unavailable", statusCode: 503 });
    }
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "user-agent": "cordon",
    };
    if (secret.value) headers.authorization = `Bearer ${secret.value}`;

    const anchor = around ? Date.parse(around) : null;
    const end = anchor === null ? Date.now() : anchor + 3_600_000;
    const start = (anchor ?? Date.now()) - hours * 3_600_000;
    const since = new Date(start).toISOString();
    const until = new Date(end).toISOString();
    const stamp = (iso: string) => iso.slice(0, 19) + "Z";

    const base = `https://api.github.com/repos/${target}`;
    const merged = encodeURIComponent(`repo:${target} is:pr is:merged merged:${stamp(since)}..${stamp(until)}`);
    const [commitsRes, pullsRes] = await Promise.all([
      fetch(`${base}/commits?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&per_page=100`, { headers }),
      fetch(`https://api.github.com/search/issues?q=${merged}&sort=updated&order=desc&per_page=50`, { headers }),
    ]);
    if (commitsRes.status === 404) {
      fail(`Repository ${target} was not found or is private. Add a GitHub token in Settings for private repositories.`, {
        errorCode: "repo_not_found",
        statusCode: 404,
      });
    }
    if (commitsRes.status === 403 || commitsRes.status === 429) {
      fail("GitHub rate limit reached. Add a GitHub token in Settings to raise it.", { errorCode: "rate_limited", statusCode: 429 });
    }
    if (!commitsRes.ok) fail(`GitHub returned HTTP ${commitsRes.status}.`, { errorCode: "github_error", statusCode: 502 });

    const commits = (await commitsRes.json()) as Array<{
      sha: string;
      html_url: string;
      commit: { message: string; author?: { name?: string; date?: string } };
      author?: { login?: string } | null;
    }>;
    const pulls = pullsRes.ok
      ? (((await pullsRes.json()) as {
          items?: Array<{
            number: number;
            title: string;
            html_url: string;
            closed_at: string | null;
            user?: { login?: string } | null;
            pull_request?: { merged_at?: string | null };
          }>;
        }).items ?? [])
      : [];

    const gap = (iso: string) => (anchor === null ? null : Math.round((anchor - Date.parse(iso)) / 60_000));
    const changes = [
      ...commits.map((c) => {
        const at = c.commit.author?.date ?? since;
        return {
          kind: "commit" as const,
          id: c.sha.slice(0, 7),
          title: (c.commit.message.split("\n")[0] ?? "").slice(0, 140),
          author: c.author?.login ?? c.commit.author?.name ?? null,
          at,
          url: c.html_url,
          minutesBeforeAround: gap(at),
        };
      }),
      ...pulls.flatMap((p) => {
        const at = p.pull_request?.merged_at ?? p.closed_at;
        if (!at) return [];
        return [
          {
            kind: "pull" as const,
            id: `#${p.number}`,
            title: p.title.slice(0, 140),
            author: p.user?.login ?? null,
            at,
            url: p.html_url,
            minutesBeforeAround: gap(at),
          },
        ];
      }),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));

    return {
      repo: target,
      since,
      until,
      changes,
      truncated: commits.length === 100,
      authenticated: Boolean(secret.value),
    };
  },
});
