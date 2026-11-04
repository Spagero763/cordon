import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { IconMessage } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

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
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() =>
        sendToAgentChat({
          message,
          ...(context ? { context: JSON.stringify(context) } : {}),
          submit,
          openSidebar: true,
        })
      }
    >
      {icon}
      {children}
    </Button>
  );
}
