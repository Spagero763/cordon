import { useAgentSelectable } from "@agent-native/toolkit/app/agent-select";
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconBolt,
  IconCheck,
  IconChecklist,
  IconFlag,
  IconHeartbeat,
  IconMessageCircle,
  IconSpeakerphone,
  IconUserCheck,
  IconZoomQuestion,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { clock, dayLabel, initials, useNow, relative } from "@/lib/format";

import { Mono } from "./marks";
import { ease, spring } from "./motion";

export interface TimelineEntry {
  id: string;
  incidentId: string;
  kind: string;
  body: string;
  actorEmail: string | null;
  actorKind: "person" | "agent" | "monitor" | "webhook";
  meta: Record<string, unknown> | null;
  createdAt: string;
}

const ICONS: Record<string, ReactNode> = {
  declared: <IconFlag className="size-3.5" />,
  note: <IconMessageCircle className="size-3.5" />,
  hypothesis: <IconZoomQuestion className="size-3.5" />,
  status: <IconBolt className="size-3.5" />,
  severity: <IconAlertTriangle className="size-3.5" />,
  commander: <IconUserCheck className="size-3.5" />,
  check: <IconHeartbeat className="size-3.5" />,
  alert: <IconAlertTriangle className="size-3.5" />,
  update: <IconSpeakerphone className="size-3.5" />,
  "action-item": <IconChecklist className="size-3.5" />,
  resolved: <IconCheck className="size-3.5" />,
  reopened: <IconArrowBackUp className="size-3.5" />,
};

const ACTOR_LABEL: Record<TimelineEntry["actorKind"], string> = {
  person: "",
  agent: "agent",
  monitor: "monitor",
  webhook: "webhook",
};

const GRID = "grid grid-cols-[3.25rem_1.5rem_minmax(0,1fr)] gap-x-3 py-2.5 pe-2 ps-1";

function toneFor(entry: TimelineEntry): string {
  switch (entry.kind) {
    case "declared":
    case "alert":
      return "text-[hsl(var(--signal-ember))] border-[hsl(var(--signal-ember)/0.4)]";
    case "severity":
      return "text-[hsl(var(--signal-amber))] border-[hsl(var(--signal-amber)/0.4)]";
    case "resolved":
      return "text-[hsl(var(--signal-moss))] border-[hsl(var(--signal-moss)/0.4)]";
    case "update":
      return "text-foreground border-foreground/40";
    case "check":
      return entry.body.startsWith("Check recovered")
        ? "text-[hsl(var(--signal-moss))] border-[hsl(var(--signal-moss)/0.4)]"
        : "text-[hsl(var(--signal-ember))] border-[hsl(var(--signal-ember)/0.4)]";
    default:
      return "text-muted-foreground border-border";
  }
}

type Entrance = "loaded" | "arrived" | "mine";

function Row({
  entry,
  now,
  entrance,
  delay,
}: {
  entry: TimelineEntry;
  now: number;
  entrance: Entrance;
  delay: number;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const picked = useAgentSelectable({
    kind: "timeline-entry",
    id: entry.id,
    title: `${clock(entry.createdAt)} ${entry.body.slice(0, 60)}`,
    getContext: () =>
      `Timeline entry ${entry.id} at ${entry.createdAt} (${entry.kind}, by ${entry.actorEmail ?? entry.actorKind}): ${entry.body}`,
    getElement: () => ref.current,
  });
  const isUpdate = entry.kind === "update";
  const who = entry.actorKind === "person" ? entry.actorEmail : ACTOR_LABEL[entry.actorKind];
  const arrived = entrance === "arrived";
  // What you typed yourself is already where you expect it; only other
  // people's and the agent's entries announce themselves.
  const still = entrance === "mine";

  return (
    <motion.li
      ref={ref}
      layout="position"
      initial={still ? false : arrived ? { opacity: 0, y: 22, scale: 0.98 } : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={arrived ? spring : { duration: 0.35, ease, delay }}
      data-picked={picked ? "true" : undefined}
      className={cn(
        "group relative transition-colors",
        GRID,
        arrived && "cordon-flash",
        picked && "rounded-md bg-[hsl(var(--signal-amber)/0.08)] ring-1 ring-[hsl(var(--signal-amber)/0.5)]",
      )}
    >
      <time
        dateTime={entry.createdAt}
        title={`${dayLabel(entry.createdAt)} ${clock(entry.createdAt, true)} · ${relative(entry.createdAt, now)}`}
        className="pt-[3px] text-end font-mono text-[11px] tabular-nums text-muted-foreground"
      >
        {clock(entry.createdAt)}
      </time>
      <span className="relative flex justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-y-[-0.625rem] left-1/2 w-px -translate-x-1/2 bg-border group-first:top-2"
        />
        <motion.span
          initial={still ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...spring, delay: arrived ? 0.05 : delay + 0.05 }}
          className={cn(
            "relative mt-[1px] flex size-5 items-center justify-center rounded-full border bg-background",
            toneFor(entry),
          )}
        >
          {ICONS[entry.kind] ?? ICONS.note}
        </motion.span>
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "whitespace-pre-wrap break-words text-[13.5px] leading-6 text-foreground",
            isUpdate && "rounded-md border border-border bg-card px-3 py-2",
            entry.kind === "hypothesis" && "italic text-foreground/85",
          )}
        >
          {isUpdate ? (
            <Mono className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Published to status page
              {typeof entry.meta?.label === "string" ? ` · ${entry.meta.label}` : ""}
            </Mono>
          ) : null}
          {entry.body}
        </p>
        {who ? (
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {entry.actorKind === "person" ? (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-muted font-mono text-[9px] text-foreground/80">
                {initials(entry.actorEmail)}
              </span>
            ) : null}
            <span className={cn(entry.actorKind !== "person" && "font-mono uppercase tracking-[0.08em]")}>{who}</span>
          </span>
        ) : null}
      </div>
    </motion.li>
  );
}

/** What the agent is doing right now, shown where its result will land. */
function AgentTail({ phrase }: { phrase: string }) {
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.3, ease }}
      aria-live="polite"
      className={cn("relative", GRID)}
    >
      <span className="pt-[3px] text-end font-mono text-[11px] text-[hsl(var(--signal-amber))]">now</span>
      <span className="relative flex justify-center">
        <span aria-hidden="true" className="absolute bottom-1/2 left-1/2 top-[-0.625rem] w-px -translate-x-1/2 bg-border" />
        <span className="relative mt-[1px] flex size-5 items-center justify-center rounded-full border border-[hsl(var(--signal-amber)/0.6)] bg-background">
          <span className="size-1.5 animate-pulse rounded-full bg-[hsl(var(--signal-amber))]" />
        </span>
      </span>
      <div className="min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={phrase}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease }}
            className="cordon-shimmer w-fit text-[13.5px] leading-6"
          >
            Agent is {phrase}
          </motion.p>
        </AnimatePresence>
        <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">agent</span>
      </div>
    </motion.li>
  );
}

export function Timeline({
  entries,
  me,
  agentPhrase,
  className,
}: {
  entries: TimelineEntry[];
  me?: string | null;
  agentPhrase?: string | null;
  className?: string;
}) {
  const now = useNow();
  const initialIds = useRef(new Set(entries.map((e) => e.id)));

  return (
    <ol className={cn("relative m-0 list-none p-0", className)}>
      <AnimatePresence initial>
        {entries.map((entry, index) => {
          const loaded = initialIds.current.has(entry.id);
          const mine = entry.actorKind === "person" && Boolean(me) && entry.actorEmail === me;
          return (
            <Row
              key={entry.id}
              entry={entry}
              now={now}
              entrance={loaded ? "loaded" : mine ? "mine" : "arrived"}
              delay={Math.min(index, 10) * 0.03}
            />
          );
        })}
        {agentPhrase ? <AgentTail key="agent-tail" phrase={agentPhrase} /> : null}
      </AnimatePresence>
    </ol>
  );
}
