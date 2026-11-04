import { defineAppConfig } from "@agent-native/core/server";

export default defineAppConfig({
  app: {
    name: "Cordon",
    sourceTemplate: "chat",
    homePath: "/incidents",
  },
});
