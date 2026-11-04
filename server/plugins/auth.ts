import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

export default createToolkitAuthPlugin({
  workspaceAppPublicPaths: ["/", "/status"],
  publicPaths: ["/status", "/api/alerts"],
  rootAuth: true,
  marketing: false,
});
