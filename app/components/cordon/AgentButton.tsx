import { generateTabId, sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { IconLoader2, IconMessage } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const RUNNING_EVENT = "agentNative.chatRunning";
// The chat keeps an unsent message for 8s while a closed sidebar loads. A
// resend after that carries the same submit id, which the chat claims once,
// so a late first delivery and the resend cannot both go through.
const BUFFER_MS = 9000;

let agentRunning = false;
if (typeof window !== "undefined") {
  window.addEventListener(RUNNING_EVENT, (event) => {
    agentRunning = Boolean((event as CustomEvent<{ isRunning?: boolean }>).detail?.isRunning);
  });
}

function runStarts(withinMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (started: boolean) => {
      window.clearTimeout(timer);
      window.removeEventListener(RUNNING_EVENT, onRunning);
      resolve(started);
    };
    const onRunning = (event: Event) => {
      if ((event as CustomEvent<{ isRunning?: boolean }>).detail?.isRunning) done(true);
    };
    const timer = window.setTimeout(() => done(false), withinMs);
    window.addEventListener(RUNNING_EVENT, onRunning);
  });
}

/** A button that hands a task to the agent sidebar with bounded context. */
export function AgentButton({
  message,
  context,
  children,
  submit = true,
  variant = "outline",
  size = "sm",
  icon = <IconMessage className="size-4" />,
  className,
}: {
  message: string;
  context?: Record<string, unknown>;
  children: ReactNode;
  submit?: boolean;
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "sm" | "default" | "icon-sm";
  icon?: ReactNode;
  className?: string;
}) {
  const [sending, setSending] = useState(false);

  async function send() {
    const request = {
      message,
      ...(context ? { context: JSON.stringify(context) } : {}),
      submit,
      openSidebar: true,
    };
    // A prefill, or a follow-up queued behind a run in progress, has no start to wait for.
    if (!submit || agentRunning) {
      sendToAgentChat(request);
      return;
    }
    setSending(true);
    try {
      const submitMessageId = `submit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const once = { ...request, submitMessageId, tabId: generateTabId() };
      for (let attempt = 0; attempt < 3; attempt++) {
        const started = runStarts(BUFFER_MS);
        sendToAgentChat(once);
        if (await started) return;
      }
      toast.error("The agent did not pick that up. Open the agent panel and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Button type="button" variant={variant} size={size} className={className} disabled={sending} onClick={() => void send()}>
      {sending ? <IconLoader2 className="size-4 animate-spin" /> : icon}
      {children}
    </Button>
  );
}
