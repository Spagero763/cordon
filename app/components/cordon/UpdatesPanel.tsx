import { actionErrorMessage, useActionMutation } from "@agent-native/core/client/hooks";
import { IconPencil, IconSpeakerphone } from "@tabler/icons-react";
import { useState } from "react";
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

function Draft({ update, incidentId }: { update: StatusUpdate; incidentId: string }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(update.body);
  const [state, setState] = useState<IncidentStatus>(update.state);
  const [confirming, setConfirming] = useState(false);

  const save = useActionMutation("draft-update", {
    onSuccess: () => setEditing(false),
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Could not save the draft."),
  });
  const publish = useActionMutation("publish-update", {
    onSuccess: () => {
      setConfirming(false);
      toast.success("Published to the status page.");
    },
    onError: (error) => {
      setConfirming(false);
      toast.error(actionErrorMessage(error) ?? "Could not publish.");
    },
  });

  return (
    <article className="rounded-lg border border-dashed border-[hsl(var(--signal-amber)/0.6)] bg-[hsl(var(--signal-amber)/0.04)] p-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[hsl(var(--signal-amber))]">
          Draft · not visible to customers
        </span>
        {!editing ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit draft" onClick={() => setEditing(true)}>
            <IconPencil className="size-4" />
          </Button>
        ) : null}
      </header>
      {editing ? (
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
          <footer className="mt-3 flex items-center justify-between gap-2">
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
          </footer>
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
    </article>
  );
}

export function UpdatesPanel({
  incidentId,
  updates,
  status,
}: {
  incidentId: string;
  updates: StatusUpdate[];
  status: IncidentStatus;
}) {
  const drafts = updates.filter((u) => !u.published);
  const published = updates.filter((u) => u.published).sort((a, b) => ((a.publishedAt ?? "") < (b.publishedAt ?? "") ? 1 : -1));
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

      {writing ? (
        <form
          className="space-y-2 rounded-lg border border-border bg-card p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim()) create.mutate({ incidentId, body: body.trim() });
          }}
        >
          <Textarea autoFocus value={body} onChange={(event) => setBody(event.target.value)} rows={4} maxLength={1200} placeholder="What is affected, what you are doing, when they will hear from you next." className="text-[13.5px] leading-6" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setWriting(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!body.trim() || create.isPending}>Save draft</Button>
          </div>
        </form>
      ) : null}

      {drafts.map((draft) => (
        <Draft key={draft.id} update={draft} incidentId={incidentId} />
      ))}

      {published.length ? (
        <ol className="space-y-3">
          {published.map((update) => (
            <li key={update.id} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <StatusPill status={update.state} />
                <time dateTime={update.publishedAt ?? undefined} className="font-mono text-[11px] text-muted-foreground">
                  {dayLabel(update.publishedAt)} {clock(update.publishedAt)}
                </time>
              </div>
              <p className="whitespace-pre-wrap text-[13.5px] leading-6">{update.body}</p>
            </li>
          ))}
        </ol>
      ) : drafts.length === 0 && !writing ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nothing published yet. Customers only see what you approve.</p>
      ) : null}
    </div>
  );
}
