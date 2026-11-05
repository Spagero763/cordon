import { useEffect, useState } from "react";

export interface AgentActivity {
  tool: string | null;
  input: Record<string, unknown> | null;
}

const PHRASES: Record<string, string> = {
  "get-incident": "reading the timeline",
  "list-incidents": "reading the board",
  "list-services": "checking what is watched",
  "get-service": "reading recent checks",
  "list-recent-changes": "reading recent commits and merges",
  "run-checks": "running the checks",
  "add-note": "logging what it found",
  "update-incident": "updating the incident",
  "draft-update": "drafting a customer update",
  "publish-update": "waiting for your approval to publish",
  "add-action-item": "adding a follow-up",
  "update-action-item": "updating a follow-up",
  "declare-incident": "opening an incident",
  "view-screen": "looking at your screen",
};

const INCIDENT_KEY: Record<string, "id" | "incidentId"> = {
  "get-incident": "id",
  "update-incident": "id",
  "add-note": "incidentId",
  "draft-update": "incidentId",
  "add-action-item": "incidentId",
};

export function agentPhrase(activity: AgentActivity): string {
  return (activity.tool && PHRASES[activity.tool]) || "thinking";
}

/** False only when the running tool names a different incident. */
export function activityTouches(activity: AgentActivity | null, incidentId: string): boolean {
  if (!activity) return false;
  const key = activity.tool ? INCIDENT_KEY[activity.tool] : undefined;
  const target = key ? activity.input?.[key] : undefined;
  return typeof target !== "string" || target === incidentId;
}

export function useAgentActivity(): AgentActivity | null {
  const [activity, setActivity] = useState<AgentActivity | null>(null);

  useEffect(() => {
    const idle: AgentActivity = { tool: null, input: null };
    // A stream that dies without a final event must not leave the tail up.
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => setActivity(null), 120_000);
    };
    const onRunning = (event: Event) => {
      const running = Boolean((event as CustomEvent<{ isRunning?: boolean }>).detail?.isRunning);
      if (running) arm();
      else clearTimeout(watchdog);
      setActivity((current) => (running ? (current ?? idle) : null));
    };
    const onToolStart = (event: Event) => {
      const detail = (event as CustomEvent<{ tool?: string; input?: unknown }>).detail;
      if (!detail?.tool) return;
      arm();
      setActivity({
        tool: detail.tool,
        input: detail.input && typeof detail.input === "object" ? (detail.input as Record<string, unknown>) : null,
      });
    };
    const onToolDone = () => setActivity((current) => (current ? idle : null));

    window.addEventListener("agentNative.chatRunning", onRunning);
    window.addEventListener("agent-native:tool-start", onToolStart);
    window.addEventListener("agent-native:tool-done", onToolDone);
    return () => {
      clearTimeout(watchdog);
      window.removeEventListener("agentNative.chatRunning", onRunning);
      window.removeEventListener("agent-native:tool-start", onToolStart);
      window.removeEventListener("agent-native:tool-done", onToolDone);
    };
  }, []);

  return activity;
}
