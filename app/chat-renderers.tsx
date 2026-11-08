import { registerActionChatRenderer } from "@agent-native/toolkit/app/chat/chat";

import { IncidentCard, readIncidentCard } from "@/components/cordon/IncidentCard";

registerActionChatRenderer({
  id: "cordon.incident",
  renderer: "cordon.incident",
  Component: ({ context }) => {
    const incident = readIncidentCard(context.resultJson);
    if (!incident) return null;
    return <IncidentCard incident={incident} className="my-1" />;
  },
});
