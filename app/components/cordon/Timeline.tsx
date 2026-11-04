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

function Row({ entry, now, first }: { entry: TimelineEntry; now: number; first: boolean }) {
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

  return (
    <motion.li
      ref={ref}
      layout="position"
      initial={first ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      data-picked={picked ? "true" : undefined}
      className={cn(
        "group relative grid grid-cols-[3.25rem_1.5rem_minmax(0,1fr)] gap-x-3 py-2.5 pe-2 ps-1 transition-colors",
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
        <span className="cordon-rail absolute inset-y-[-0.625rem] left-1/2 w-px -translate-x-1/2 bg-border group-first:top-2 group-last:bottom-2" />
        <span
          className={cn(
            "relative z-10 mt-[1px] flex size-5 items-center justify-center rounded-full border bg-background",
            toneFor(entry),
          )}
        >
          {ICONS[entry.kind] ?? ICONS.note}
        </span>
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

export function Timeline({ entries, className }: { entries: TimelineEntry[]; className?: string }) {
  const now = useNow();
  const firstRender = useRef(true);
  const initialIds = useRef(new Set(entries.map((e) => e.id)));
  if (firstRender.current) firstRender.current = false;

  return (
    <ol className={cn("relative m-0 list-none p-0", className)}>
      <AnimatePresence initial={false}>
        {entries.map((entry) => (
          <Row key={entry.id} entry={entry} now={now} first={initialIds.current.has(entry.id)} />
        ))}
      </AnimatePresence>
    </ol>
  );
}
