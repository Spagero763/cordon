import { actionErrorMessage, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { IconActivity, IconFlag, IconRefresh } from "@tabler/icons-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { duration, relative, useNow } from "@/lib/format";
import { cn } from "@/lib/utils";

import { AgentButton } from "@/components/cordon/AgentButton";
import { CordonStripe } from "@/components/cordon/CordonStripe";
import { DeclareDialog } from "@/components/cordon/DeclareDialog";
import { HealthDot, SeverityBadge, StatusPill } from "@/components/cordon/marks";

export default function IncidentsBoard() {
  useSetPageTitle("Incidents");
  const now = useNow();
  const open = useActionQuery("list-incidents", { filter: "open" });
  const resolved = useActionQuery("list-incidents", { filter: "resolved", limit: 12 });
  const services = useActionQuery("list-services", {});
  const check = useActionMutation("run-checks", {
    onSuccess: (result) => {
      const failing = result.checks.filter((c) => !c.ok).length;
      if (result.declaredIncidentIds.length) toast.warning(`Opened ${result.declaredIncidentIds.length} incident${result.declaredIncidentIds.length > 1 ? "s" : ""}.`);
      else if (failing) toast.warning(`${failing} check${failing > 1 ? "s" : ""} failing.`);
      else toast.success(`All ${result.checks.length} checks passed.`);
    },
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Checks failed to run."),
  });

  const openIncidents = open.data?.incidents ?? [];
  const active = openIncidents.length > 0;
  const loading = open.isPending || services.isPending;

  return (
    <div className="flex min-h-full flex-col">
      <CordonStripe active={active} />
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-md border",
                active
                  ? "border-[hsl(var(--signal-ember)/0.5)] text-[hsl(var(--signal-ember))]"
                  : "border-[hsl(var(--signal-moss)/0.5)] text-[hsl(var(--signal-moss))]",
              )}
            >
              {active ? <IconFlag className="size-4" /> : <IconActivity className="size-4" />}
            </span>
            <div>
              <h1 className="text-base font-semibold leading-tight">
                {loading ? "Checking" : active ? `${openIncidents.length} open incident${openIncidents.length > 1 ? "s" : ""}` : "All clear"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {loading
                  ? "Reading the board"
                  : services.data?.services.length
                    ? `${services.data.services.length} service${services.data.services.length > 1 ? "s" : ""} watched`
                    : "No services watched yet"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={check.isPending || !services.data?.services.length} onClick={() => check.mutate({ force: true })}>
              <IconRefresh className={cn("size-4", check.isPending && "animate-spin")} />
              Check now
            </Button>
            <DeclareDialog trigger={<Button type="button" size="sm">Declare</Button>} />
          </div>
        </header>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : (
          <>
            {active ? (
              <ul className="space-y-3">
                {openIncidents.map((incident, index) => (
                  <motion.li
                    key={incident.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.04 }}
                  >
                    <Link
                      to={`/incidents/${encodeURIComponent(incident.id)}`}
                      className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-1.5 flex items-center gap-2">
                            <SeverityBadge severity={incident.severity} />
                            <StatusPill status={incident.status} live />
                          </div>
                          <h2 className="truncate text-[15px] font-medium leading-6">{incident.title}</h2>
                          <p className="text-xs text-muted-foreground">
                            {incident.serviceName ? `${incident.serviceName} · ` : ""}
                            {incident.commanderEmail ? `${incident.commanderEmail} has it` : "No commander yet"}
                          </p>
                        </div>
                        <div className="shrink-0 text-end">
                          <p className="font-mono text-lg tabular-nums leading-none">{duration(incident.startedAt, null, now)}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">open</p>
                        </div>
                      </div>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            ) : services.data?.services.length ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">Nothing open. Checks keep running on their interval.</p>
              </div>
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

            {services.data?.services.length ? (
              <section className="mt-8">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Services</h2>
                  <Link to="/services" className="text-xs text-muted-foreground hover:text-foreground">Manage</Link>
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {services.data.services.map((service) => (
                    <li key={service.id} className="flex items-center gap-3 px-3 py-2.5">
                      <HealthDot ok={service.enabled ? service.lastCheckOk : null} />
                      <span className="min-w-0 flex-1 truncate text-sm">{service.name}</span>
                      {service.openIncidentId ? (
                        <Link to={`/incidents/${encodeURIComponent(service.openIncidentId)}`} className="text-xs text-[hsl(var(--signal-ember))] hover:underline">
                          incident open
                        </Link>
                      ) : null}
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {!service.enabled ? "paused" : service.lastCheckAt ? relative(service.lastCheckAt, now) : "not checked"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {resolved.data?.incidents.length ? (
              <section className="mt-8">
                <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Resolved</h2>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {resolved.data.incidents.map((incident) => (
                    <li key={incident.id}>
                      <Link to={`/incidents/${encodeURIComponent(incident.id)}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
                        <SeverityBadge severity={incident.severity} className="h-5 px-1.5 text-[10px]" />
                        <span className="min-w-0 flex-1 truncate text-sm">{incident.title}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {duration(incident.startedAt, incident.resolvedAt)} · {relative(incident.resolvedAt, now)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
