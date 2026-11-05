import { actionErrorMessage, useActionMutation } from "@agent-native/core/client/hooks";
import { IconPencil, IconSpeakerphone } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { clock, dayLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  INCIDENT_STATUSES,
  STATUS_LABEL,
  type IncidentStatus,
} from "../../../shared/incident";
import { AgentButton } from "./AgentButton";
import { StatusPill } from "./marks";
import { ease, spring } from "./motion";

export interface StatusUpdate {
  id: string;
  incidentId: string;
  body: string;
  state: IncidentStatus;
  published: boolean;
  publishedAt: string | null;
  authorEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One card for the whole life of an update. A draft and its published form
 * share a key, so approving it sets the card in place instead of swapping it.
 */
function UpdateCard({ update, incidentId }: { update: StatusUpdate; incidentId: string }) {
  const draft = !update.published;
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(update.body);
  const [state, setState] = useState<IncidentStatus>(update.state);
  const [confirming, setConfirming] = useState(false);

  const wasDraft = useRef(draft);
  const [justSet, setJustSet] = useState(false);
  useEffect(() => {
    if (wasDraft.current && !draft) {
      setJustSet(true);
      const timer = setTimeout(() => setJustSet(false), 1500);
      wasDraft.current = draft;
      return () => clearTimeout(timer);
    }
    wasDraft.current = draft;
  }, [draft]);

  const save = useActionMutation("draft-update", {
    onSuccess: () => setEditing(false),
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Could not save the draft."),
  });
  const publish = useActionMutation("publish-update", {
    onSuccess: () => setConfirming(false),
    onError: (error) => {
      setConfirming(false);
      toast.error(actionErrorMessage(error) ?? "Could not publish.");
    },
  });

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={spring}
      className={cn(
        "rounded-lg border p-3 transition-[border-color,background-color] duration-700",
        draft
          ? "border-dashed border-[hsl(var(--signal-amber)/0.6)] bg-[hsl(var(--signal-amber)/0.04)]"
          : "border-border bg-card",
        justSet && "cordon-set",
      )}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <span className="relative block h-4 min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={draft ? "draft" : "published"}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.35, ease }}
              className={cn(
                "absolute inset-0 truncate font-mono text-[10px] uppercase leading-4 tracking-[0.1em]",
                draft ? "text-[hsl(var(--signal-amber))]" : "text-[hsl(var(--signal-moss))]",
              )}
            >
              {draft
                ? "Draft · not visible to customers"
                : `Published ${dayLabel(update.publishedAt)} ${clock(update.publishedAt)}`}
            </motion.span>
          </AnimatePresence>
        </span>
        {draft && !editing ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit draft" onClick={() => setEditing(true)}>
            <IconPencil className="size-4" />
          </Button>
        ) : null}
      </header>

      {draft && editing ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Update state">
            {INCIDENT_STATUSES.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={state === option}
                onClick={() => setState(option)}
                className={cn(
                  "h-7 rounded-md border border-transparent px-2 text-xs text-muted-foreground hover:text-foreground",
                  state === option && "border-border bg-background text-foreground",
                )}
              >
                {STATUS_LABEL[option]}
              </button>
            ))}
          </div>
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} maxLength={1200} className="text-[13.5px] leading-6" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setBody(update.body); setState(update.state); }}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={!body.trim() || save.isPending} onClick={() => save.mutate({ incidentId, id: update.id, body: body.trim(), state })}>
              Save draft
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2"><StatusPill status={update.state} /></div>
          <p className="whitespace-pre-wrap text-[13.5px] leading-6">{update.body}</p>
          <AnimatePresence initial={false}>
            {draft ? (
              <motion.footer
                key="actions"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 pt-3">
                  <AgentButton
                    variant="ghost"
                    message="Tighten this draft customer update. Keep it to three sentences and the facts on the timeline."
                    context={{ incidentId, updateId: update.id }}
                  >
                    Ask the agent to tighten
                  </AgentButton>
                  <Button type="button" size="sm" className="cordon-publish" onClick={() => setConfirming(true)} disabled={publish.isPending}>
                    <IconSpeakerphone className="size-4" />
                    Publish
                  </Button>
                </div>
              </motion.footer>
            ) : null}
          </AnimatePresence>
        </>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish to the status page?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Customers will see this immediately. It cannot be edited after publishing.</p>
                <blockquote className="rounded-md border border-border bg-muted/40 p-3 text-[13px] leading-6 text-foreground">
                  {update.body}
                </blockquote>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep drafting</AlertDialogCancel>
            <AlertDialogAction disabled={publish.isPending} onClick={() => publish.mutate({ id: update.id })}>
              {publish.isPending ? "Publishing" : "Publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.li>
  );
}

export function UpdatesPanel({
  incidentId,
  updates,
  status,
  agentDrafting = false,
}: {
  incidentId: string;
  updates: StatusUpdate[];
  status: IncidentStatus;
  agentDrafting?: boolean;
}) {
  const ordered = [...updates].sort((a, b) => {
    if (a.published !== b.published) return a.published ? 1 : -1;
    const left = a.publishedAt ?? a.createdAt;
    const right = b.publishedAt ?? b.createdAt;
    return left < right ? 1 : -1;
  });
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState("");
  const create = useActionMutation("draft-update", {
    onSuccess: () => {
      setWriting(false);
      setBody("");
    },
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Could not save the draft."),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <AgentButton
          message={
            status === "resolved"
              ? "Draft the resolved customer update for this incident."
              : "Draft the next customer update for this incident from the timeline."
          }
          context={{ incidentId }}
        >
          Draft with the agent
        </AgentButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setWriting((v) => !v)}>
          Write it myself
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {writing ? (
          <motion.form
            key="compose"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden"
            onSubmit={(event) => {
              event.preventDefault();
              if (body.trim()) create.mutate({ incidentId, body: body.trim() });
            }}
          >
            <div className="space-y-2 rounded-lg border border-border bg-card p-3">
              <Textarea autoFocus value={body} onChange={(event) => setBody(event.target.value)} rows={4} maxLength={1200} placeholder="What is affected, what you are doing, when they will hear from you next." className="text-[13.5px] leading-6" />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setWriting(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={!body.trim() || create.isPending}>Save draft</Button>
              </div>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      <ul className="m-0 list-none space-y-3 p-0">
        <AnimatePresence initial={false}>
          {agentDrafting ? (
            <motion.li
              key="agent-ghost"
              layout="position"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={spring}
              aria-live="polite"
              className="rounded-lg border border-dashed border-[hsl(var(--signal-amber)/0.5)] p-3"
            >
              <p className="cordon-shimmer mb-3 w-fit font-mono text-[10px] uppercase tracking-[0.1em]">Agent is drafting an update</p>
              <div className="space-y-2">
                <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
              </div>
            </motion.li>
          ) : null}
          {ordered.map((update) => (
            <UpdateCard key={update.id} update={update} incidentId={incidentId} />
          ))}
        </AnimatePresence>
      </ul>

      {ordered.length === 0 && !writing && !agentDrafting ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nothing published yet. Customers only see what you approve.</p>
      ) : null}
    </div>
  );
}
