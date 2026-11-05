import { actionErrorMessage, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { IconActivity, IconArrowUpRight, IconFlag, IconRefresh } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { agentPhrase, useAgentActivity } from "@/hooks/use-agent-activity";
import { duration, relative, useNow } from "@/lib/format";
import { cn } from "@/lib/utils";

import { AgentButton } from "@/components/cordon/AgentButton";
import { CordonStripe } from "@/components/cordon/CordonStripe";
import { DeclareDialog } from "@/components/cordon/DeclareDialog";
import { PageEnter, Rise } from "@/components/cordon/PageEnter";
import { Sweep } from "@/components/cordon/Sweep";
import { Ticker } from "@/components/cordon/Ticker";
import { UptimeBars } from "@/components/cordon/UptimeBars";
import { HealthDot, SeverityBadge, StatusPill } from "@/components/cordon/marks";
import { ease, spring } from "@/components/cordon/motion";

const LIVE = { refetchInterval: 15_000 };

const SEVERITY_EDGE: Record<string, string> = {
  sev1: "bg-[hsl(var(--signal-ember))]",
  sev2: "bg-[hsl(var(--signal-amber))]",
  sev3: "bg-[hsl(var(--signal-slate))]",
  sev4: "bg-muted-foreground/40",
};

export default function IncidentsBoard() {
  useSetPageTitle("Incidents");
  const now = useNow();
  const open = useActionQuery("list-incidents", { filter: "open" }, LIVE);
  const resolved = useActionQuery("list-incidents", { filter: "resolved", limit: 12 }, LIVE);
  const services = useActionQuery("list-services", {}, LIVE);
  const check = useActionMutation("run-checks", {
    onSuccess: (result) => {
      const failing = result.checks.filter((c) => !c.ok).length;
      if (result.declaredIncidentIds.length) toast.warning(`Opened ${result.declaredIncidentIds.length} incident${result.declaredIncidentIds.length > 1 ? "s" : ""}.`);
      else if (failing) toast.warning(`${failing} check${failing > 1 ? "s" : ""} failing.`);
      else toast.success(`All ${result.checks.length} checks passed.`);
    },
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Checks failed to run."),
  });

  const activity = useAgentActivity();
  const openIncidents = open.data?.incidents ?? [];
  const serviceList = services.data?.services ?? [];
  const active = openIncidents.length > 0;
  // Movement means nobody knows the cause yet. Identified and monitoring hold still.
  const hunting = openIncidents.some((incident) => incident.status === "investigating");
  const loading = open.isPending || services.isPending;
  const headline = loading
    ? "Checking"
    : active
      ? `${openIncidents.length} open incident${openIncidents.length > 1 ? "s" : ""}`
      : "All clear";

  return (
    <div className="cordon-page relative flex min-h-full flex-col">
      <Sweep open={open.data ? openIncidents.length : null} />
      <CordonStripe active={active} live={hunting} />
      <PageEnter className="mx-auto w-full max-w-3xl px-4 pb-16 pt-7 sm:px-6">
        <Rise className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-5">
            <span
              className="relative flex size-11 shrink-0 items-center justify-center"
              style={
                {
                  "--radar": hunting ? "var(--signal-ember)" : "var(--signal-moss)",
                  "--radar-speed": hunting ? "1.5s" : "3.6s",
                } as React.CSSProperties
              }
            >
              {!loading && (hunting || !active) ? (
                <>
                  <span className="cordon-radar" />
                  {hunting ? <span className="cordon-radar" /> : null}
                </>
              ) : null}
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={active ? "open" : "clear"}
                  initial={{ scale: 0.5, rotate: -25, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.5, rotate: 25, opacity: 0 }}
                  transition={spring}
                  className={cn(
                    "relative flex size-11 items-center justify-center rounded-full border bg-background",
                    active
                      ? "border-[hsl(var(--signal-ember)/0.6)] text-[hsl(var(--signal-ember))]"
                      : "border-[hsl(var(--signal-moss)/0.6)] text-[hsl(var(--signal-moss))]",
                  )}
                >
                  {active ? <IconFlag className="size-5" /> : <IconActivity className="size-5" />}
                </motion.span>
              </AnimatePresence>
            </span>
            <div className="overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.h1
                  key={headline}
                  initial={{ y: 14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -14, opacity: 0 }}
                  transition={{ duration: 0.3, ease }}
                  className="text-xl font-semibold leading-tight tracking-tight"
                >
                  {headline}
                </motion.h1>
              </AnimatePresence>
              <p className={cn("w-fit text-xs text-muted-foreground", activity && "cordon-shimmer")} aria-live="polite">
                {activity
                  ? `Agent is ${agentPhrase(activity)}`
                  : loading
                    ? "Reading the board"
                    : serviceList.length
                      ? `${serviceList.length} service${serviceList.length > 1 ? "s" : ""} watched`
                      : "No services watched yet"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={check.isPending || !serviceList.length} onClick={() => check.mutate({ force: true })}>
              <IconRefresh className={cn("size-4", check.isPending && "animate-spin")} />
              Check now
            </Button>
            <DeclareDialog trigger={<Button type="button" size="sm">Declare</Button>} />
          </div>
        </Rise>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : (
          <>
            <Rise>
              {active ? (
                <ul className="space-y-3">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {openIncidents.map((incident) => (
                      <motion.li
                        key={incident.id}
                        layout
                        initial={{ opacity: 0, y: 24, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 48, scale: 0.96 }}
                        transition={spring}
                        whileHover={{ y: -2 }}
                      >
                        <Link
                          to={`/incidents/${encodeURIComponent(incident.id)}`}
                          className="group relative block overflow-hidden rounded-lg border border-border bg-card p-4 ps-5 transition-[border-color,box-shadow] duration-200 hover:border-foreground/35 hover:shadow-[0_10px_30px_-18px_hsl(var(--signal-ember)/0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className={cn("absolute inset-y-0 start-0 w-1", SEVERITY_EDGE[incident.severity])} />
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="mb-1.5 flex items-center gap-2">
                                <SeverityBadge severity={incident.severity} />
                                <StatusPill status={incident.status} live />
                              </div>
                              <h2 className="flex items-center gap-1 truncate text-[15px] font-medium leading-6">
                                <span className="truncate">{incident.title}</span>
                                <IconArrowUpRight className="size-4 shrink-0 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-70" />
                              </h2>
                              <p className="text-xs text-muted-foreground">
                                {incident.serviceName ? `${incident.serviceName} · ` : ""}
                                {incident.commanderEmail ? `${incident.commanderEmail} has it` : "No commander yet"}
                              </p>
                            </div>
                            <div className="shrink-0 text-end">
                              <Ticker since={incident.startedAt} className="text-xl" />
                              <p className="mt-1.5 text-[11px] text-muted-foreground">open</p>
                            </div>
                          </div>
                        </Link>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              ) : serviceList.length ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease }}
                  className="rounded-lg border border-dashed border-[hsl(var(--signal-moss)/0.35)] p-8 text-center"
                >
                  <p className="text-sm text-muted-foreground">Nothing open. Checks keep running on their interval.</p>
                </motion.div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="mb-3 text-sm text-muted-foreground">Add the first service to watch, or declare an incident by hand.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild size="sm" variant="outline"><Link to="/services">Add a service</Link></Button>
                    <AgentButton message="Set up Cordon for me: ask which services to watch, add them, run the first checks, and create the status page." submit={false}>
                      Set up with the agent
                    </AgentButton>
                  </div>
                </div>
              )}
            </Rise>

            {serviceList.length ? (
              <Rise className="mt-9">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Services</h2>
                  <Link to="/services" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Manage</Link>
                </div>
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {serviceList.map((service, index) => (
                    <motion.li
                      key={service.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, ease, delay: 0.15 + index * 0.05 }}
                    >
                      <Link
                        to={`/services?serviceId=${encodeURIComponent(service.id)}`}
                        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40"
                      >
                        <HealthDot ok={service.enabled ? service.lastCheckOk : null} />
                        <span className="min-w-0 flex-1 truncate text-sm">{service.name}</span>
                        {service.openIncidentId ? (
                          <span className="text-xs text-[hsl(var(--signal-ember))]">incident open</span>
                        ) : null}
                        <UptimeBars checks={service.recentChecks} className="hidden sm:flex" />
                        <span className="w-20 text-end font-mono text-[11px] text-muted-foreground">
                          {!service.enabled ? "paused" : service.lastCheckAt ? relative(service.lastCheckAt, now) : "not checked"}
                        </span>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </Rise>
            ) : null}

            {resolved.data?.incidents.length ? (
              <Rise className="mt-9">
                <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Resolved</h2>
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {resolved.data.incidents.map((incident, index) => (
                    <motion.li
                      key={incident.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, ease, delay: 0.2 + index * 0.04 }}
                    >
                      <Link to={`/incidents/${encodeURIComponent(incident.id)}`} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
                        <SeverityBadge severity={incident.severity} className="h-5 px-1.5 text-[10px]" />
                        <span className="min-w-0 flex-1 truncate text-sm">{incident.title}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {duration(incident.startedAt, incident.resolvedAt)} · {relative(incident.resolvedAt, now)}
                        </span>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </Rise>
            ) : null}
          </>
        )}
      </PageEnter>
    </div>
  );
}
