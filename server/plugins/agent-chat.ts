import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import "../lib/github.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "list-incidents",
  "get-incident",
  "declare-incident",
  "update-incident",
  "add-note",
  "draft-update",
  "publish-update",
  "list-services",
  "run-checks",
  "list-recent-changes",
  "ingest-alert",
  "add-action-item",
  "ask-question",
];

export default createAgentChatPlugin({
  appId: "cordon",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: {
    connectorCatalog: [
      "list-incidents",
      "get-incident",
      "declare-incident",
      "update-incident",
      "add-note",
      "draft-update",
      "list-services",
      "run-checks",
      "ingest-alert",
      "list-recent-changes",
      "navigate",
      "tool-search",
    ],
    appApprovalPage: true,
    instructions:
      "Cordon runs production incidents for small teams. Read the open incident with get-incident before changing it. Post findings with add-note so the people in the room see them on the same timeline. Draft customer updates with draft-update; only a person can publish them.",
  },
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `You are the Cordon agent. You help a small team run production incidents: detect, triage, communicate, resolve, and learn.

The timeline is the shared record. Everything you do through an action is logged there next to what the people do, so never repeat an action's own log entry in a note. Read <current-screen> first; when an incident is on screen, call get-incident before you act on it. Load the incident-command skill when an incident opens or changes, customer-updates before drafting anything customers will read, and postmortem after an incident is resolved.

You propose and draft. The person decides severity when they disagree, publishes every customer update, and resolves the incident. Never fabricate a time, a cause, or a check result; say what the timeline does not show.`,
});
