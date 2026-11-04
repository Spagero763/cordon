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
});

export default defineAction({
  description:
    "List commits and merged pull requests on a service's GitHub repository inside a recent window, newest first. Use it to answer \"what changed\" during triage. Works on public repositories without a token; private ones need the GitHub token in Settings.",
  schema: z.object({
    serviceId: z.string().optional().describe("Service id; its configured repository is used"),
    repo: z.string().regex(REPO).optional().describe('GitHub "owner/name"; used when no serviceId is given'),
    hours: z.coerce.number().int().min(1).max(168).default(24).describe("Window in hours; defaults to 24"),
  }),
  outputSchema: z.object({
    repo: z.string(),
    since: z.string(),
    changes: z.array(changeShape),
    authenticated: z.boolean(),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ serviceId, repo, hours }) => {
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

    const since = new Date(Date.now() - hours * 3_600_000).toISOString();
    const base = `https://api.github.com/repos/${target}`;
    const [commitsRes, pullsRes] = await Promise.all([
      fetch(`${base}/commits?since=${encodeURIComponent(since)}&per_page=30`, { headers }),
      fetch(`${base}/pulls?state=closed&sort=updated&direction=desc&per_page=30`, { headers }),
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
      ? ((await pullsRes.json()) as Array<{
          number: number;
          title: string;
          html_url: string;
          merged_at: string | null;
          user?: { login?: string } | null;
        }>)
      : [];

    const changes = [
      ...commits.map((c) => ({
        kind: "commit" as const,
        id: c.sha.slice(0, 7),
        title: (c.commit.message.split("\n")[0] ?? "").slice(0, 140),
        author: c.author?.login ?? c.commit.author?.name ?? null,
        at: c.commit.author?.date ?? since,
        url: c.html_url,
      })),
      ...pulls
        .filter((p) => p.merged_at && p.merged_at >= since)
        .map((p) => ({
          kind: "pull" as const,
          id: `#${p.number}`,
          title: p.title.slice(0, 140),
          author: p.user?.login ?? null,
          at: p.merged_at as string,
          url: p.html_url,
        })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));

    return { repo: target, since, changes, authenticated: Boolean(secret.value) };
  },
});
