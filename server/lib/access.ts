import { fail } from "@agent-native/core/action";

import type { Actor } from "./incidents.js";

export interface RunCtx {
  userEmail?: string | null;
  orgId?: string | null;
  caller?: string | null;
}

export function requireUser(ctx: RunCtx | undefined): string {
  const email = ctx?.userEmail;
  if (!email) fail("Sign in first.", { statusCode: 401, errorCode: "unauthenticated" });
  return email;
}

export function orgOf(ctx: RunCtx | undefined): string | null {
  return ctx?.orgId ?? null;
}

/** The agent runs as the signed-in user; the caller tag separates the two on the timeline. */
export function actorFromCtx(ctx: RunCtx | undefined): Actor {
  const caller = ctx?.caller ?? "";
  const kind = caller === "frontend" || caller === "http" || caller === "" ? "person" : "agent";
  return { email: ctx?.userEmail ?? null, kind };
}
