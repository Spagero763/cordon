import { Outlet } from "react-router";

import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: `Incidents - ${APP_TITLE}` }];
}

export default function IncidentsLayout() {
  return <Outlet />;
}
