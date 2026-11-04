import { Navigate } from "react-router";

import { APP_TITLE } from "@/lib/app-config";

const SEO_TITLE = `${APP_TITLE} - Incident response for small teams`;
const SEO_DESCRIPTION =
  "Watch your services, run incidents on one shared timeline, keep customers informed, and learn from every outage.";

export function meta() {
  return [
    { title: SEO_TITLE },
    { name: "description", content: SEO_DESCRIPTION },
    { property: "og:title", content: SEO_TITLE },
    { property: "og:description", content: SEO_DESCRIPTION },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: SEO_TITLE },
    { name: "twitter:description", content: SEO_DESCRIPTION },
  ];
}

export default function HomeRoute() {
  return <Navigate to="/incidents" replace />;
}
