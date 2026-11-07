import { actionErrorMessage, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useSession } from "@agent-native/core/client/use-session";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { ShareButton } from "@agent-native/toolkit/app/sharing";
import { IconArrowLeft, IconChevronDown } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { activityTouches, agentPhrase, useAgentActivity } from "@/hooks/use-agent-activity";
import { personName, utcClock } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  INCIDENT_STATUSES,
  SEVERITIES,
  STATUS_LABEL,
  type IncidentStatus,
  type Severity,
} from "../../shared/incident";
import { AgentButton } from "@/components/cordon/AgentButton";
import { CordonStripe } from "@/components/cordon/CordonStripe";
import { EditableTitle } from "@/components/cordon/EditableTitle";
import { NoteComposer } from "@/components/cordon/NoteComposer";
import { PageEnter, Rise } from "@/components/cordon/PageEnter";
import { PostmortemPanel } from "@/components/cordon/PostmortemPanel";
import { Sweep } from "@/components/cordon/Sweep";
import { Ticker } from "@/components/cordon/Ticker";
import { Timeline } from "@/components/cordon/Timeline";
import { UpdatesPanel } from "@/components/cordon/UpdatesPanel";
import { SeverityBadge, StatusPill } from "@/components/cordon/marks";
import { ease, spring } from "@/components/cordon/motion";

const TABS = [
  { id: "timeline", label: "Timeline" },
  { id: "updates", label: "Customer updates" },
  { id: "postmortem", label: "Postmortem" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function useCurrentUserEmail(): string | null {
  const { session } = useSession();
  return session?.email ?? null;
}

export default function IncidentRoom() {
  const { incidentId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === searchParams.get("tab")) ? searchParams.get("tab") : "timeline") as Tab;
  const queryClient = useQueryClient();
  const userEmail = useCurrentUserEmail();
  const params = useMemo(() => ({ id: incidentId }), [incidentId]);
  const queryKey = ["action", "get-incident", params];
  const { data: incident, isPending, error } = useActionQuery("get-incident", params);
  useSetPageTitle(incident?.title ?? "Incident");

  const [severityPulse, setSeverityPulse] = useState(false);
  const lastSeverity = useRef<Severity | null>(null);
  useEffect(() => {
    if (!incident) return;
    if (lastSeverity.current && lastSeverity.current !== incident.severity) {
      setSeverityPulse(true);
      lastSeverity.current = incident.severity;
      const timer = setTimeout(() => setSeverityPulse(false), 900);
      return () => clearTimeout(timer);
    }
    lastSeverity.current = incident.severity;
  }, [incident?.severity, incident]);

  const update = useActionMutation("update-incident", {
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: typeof incident) => (old ? { ...old, ...patch } : old));
      return { previous };
    },
    onError: (err, _patch, context) => {
      queryClient.setQueryData(queryKey, (context as { previous?: unknown } | undefined)?.previous);
      toast.error(actionErrorMessage(err) ?? "Could not update the incident.");
    },
  });

  // Follow new entries, but leave the page at the top on arrival.
  const bottomRef = useRef<HTMLDivElement>(null);
  const entryCount = incident ? incident.timeline.length : null;
  const seenCount = useRef<number | null>(null);
  useEffect(() => {
    if (entryCount === null) return;
    if (tab === "timeline" && seenCount.current !== null && entryCount > seenCount.current) {
      bottomRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    seenCount.current = entryCount;
  }, [entryCount, tab]);

  useEffect(() => {
    if (incident?.title) document.title = `${incident.title} - Cordon`;
  }, [incident?.title]);

  const activity = useAgentActivity();
  const agentHere = activity && activityTouches(activity, incidentId) ? activity : null;

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        <Skeleton className="mb-4 h-6 w-32" />
        <Skeleton className="mb-6 h-10 w-3/4" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }
  if (error || !incident) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-10 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">{actionErrorMessage(error) ?? "This incident is not available."}</p>
        <Button asChild variant="link"><Link to="/incidents">Back to the board</Link></Button>
      </div>
    );
  }

  const open = incident.status !== "resolved";
  const drafts = incident.updates.filter((u) => !u.published).length;

  return (
    <div className="cordon-page relative flex min-h-full flex-col">
      <Sweep open={open ? 1 : 0} />
      <CordonStripe active={open} live={incident.status === "investigating"} />
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-5 sm:px-6">
        <PageEnter>
          <Rise className="mb-4 flex items-center justify-between">
            <Link to="/incidents" className="group inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <IconArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
              Board
            </Link>
            <ShareButton resourceType="incident" resourceId={incident.id} resourceTitle={incident.title} />
          </Rise>

          <Rise className="mb-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Change severity">
                    <motion.span
                      key={incident.severity}
                      initial={{ scale: 1.25, rotate: -4 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={spring}
                      className="inline-flex"
                    >
                      <SeverityBadge severity={incident.severity} pulse={severityPulse} className="cursor-pointer" />
                    </motion.span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {SEVERITIES.map((s) => (
                    <DropdownMenuItem key={s} disabled={s === incident.severity} onSelect={() => update.mutate({ id: incident.id, severity: s })}>
                      <SeverityBadge severity={s} className="me-2 h-5 px-1.5 text-[10px]" />
                      {s === incident.severity ? "current" : "set"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="inline-flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Change status">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={incident.status}
                        initial={{ y: 8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -8, opacity: 0 }}
                        transition={{ duration: 0.2, ease }}
                        className="inline-flex"
                      >
                        <StatusPill status={incident.status} live />
                      </motion.span>
                    </AnimatePresence>
                    <IconChevronDown className="ms-1 size-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {INCIDENT_STATUSES.map((s) => (
                    <DropdownMenuItem key={s} disabled={s === incident.status} onSelect={() => update.mutate({ id: incident.id, status: s as IncidentStatus })}>
                      {STATUS_LABEL[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="ms-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                <Ticker since={incident.startedAt} until={open ? null : incident.resolvedAt} className={cn("text-sm", open ? "text-foreground" : "text-muted-foreground")} />
                <span className="font-mono tabular-nums">{open ? "open" : "total"} · from {utcClock(incident.startedAt)}</span>
              </span>
            </div>
            <EditableTitle
              value={incident.title}
              onSave={(title) => update.mutate({ id: incident.id, title })}
              className="text-balance text-xl font-semibold leading-7 tracking-tight [overflow-wrap:anywhere] sm:text-2xl"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              {incident.serviceName ? `${incident.serviceName} · ` : ""}
              {incident.commanderEmail ? (
                <>
                  <span className="text-foreground">{personName(incident.commanderEmail, incident.people)}</span> is commander
                </>
              ) : userEmail ? (
                <button type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={() => update.mutate({ id: incident.id, commanderEmail: userEmail })}>
                  No commander. Take it
                </button>
              ) : (
                "No commander yet"
              )}
            </p>
          </Rise>

          <Rise className="mb-4 flex flex-wrap items-center gap-2">
            {open ? (
              <>
                <AgentButton message="Triage this incident: what is broken, when it started, what changed. Log what you find." context={{ incidentId: incident.id }}>
                  Triage
                </AgentButton>
                <AgentButton variant="ghost" message="What changed on this service in the last 24 hours? List commits and merged pull requests with times." context={{ incidentId: incident.id, serviceId: incident.serviceId }}>
                  What changed?
                </AgentButton>
              </>
            ) : (
              <AgentButton message="Write the postmortem for this incident from its timeline." context={{ incidentId: incident.id }}>
                Write the postmortem
              </AgentButton>
            )}
            <div className="ms-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-md border border-border p-0.5" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setSearchParams(t.id === "timeline" ? {} : { tab: t.id }, { replace: true })}
                  className={cn(
                    "relative h-7 shrink-0 whitespace-nowrap rounded px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                    tab === t.id && "text-foreground",
                  )}
                >
                  {tab === t.id ? (
                    <motion.span layoutId="incident-tab" transition={spring} className="absolute inset-0 rounded bg-muted" />
                  ) : null}
                  <span className="relative">
                    {t.label}
                    {t.id === "updates" && drafts ? (
                      <span className="ms-1.5 rounded-full bg-[hsl(var(--signal-amber)/0.18)] px-1.5 font-mono text-[10px] text-[hsl(var(--signal-amber))]">{drafts}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </Rise>
        </PageEnter>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease }}
          >
            {tab === "timeline" ? (
              <>
                <Timeline
                  entries={incident.timeline}
                  me={userEmail}
                  people={incident.people}
                  agentPhrase={agentHere ? agentPhrase(agentHere) : null}
                  className="mb-4"
                />
                <div ref={bottomRef} />
                <div className="sticky bottom-0 z-20 bg-background pb-3 before:pointer-events-none before:absolute before:inset-x-0 before:-top-8 before:h-8 before:bg-gradient-to-t before:from-background before:to-transparent">
                  <NoteComposer incidentId={incident.id} queryKey={queryKey} userEmail={userEmail} />
                </div>
              </>
            ) : tab === "updates" ? (
              <UpdatesPanel
                incidentId={incident.id}
                updates={incident.updates}
                status={incident.status}
                agentDrafting={agentHere?.tool === "draft-update"}
              />
            ) : (
              <PostmortemPanel incident={incident} actionItems={incident.actionItems} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
