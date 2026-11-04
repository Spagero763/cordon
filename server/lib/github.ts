import { registerRequiredSecret } from "@agent-native/core/secrets";

export const GITHUB_TOKEN_KEY = "GITHUB_TOKEN";

registerRequiredSecret({
  key: GITHUB_TOKEN_KEY,
  label: "GitHub token",
  description:
    "Lets Cordon list recent commits and merged pull requests on private repositories and raises the rate limit on public ones. A fine-grained token with read access to contents and pull requests is enough.",
  docsUrl: "https://github.com/settings/personal-access-tokens",
  scope: "user",
  kind: "api-key",
  required: false,
});
