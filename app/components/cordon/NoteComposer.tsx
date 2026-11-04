import { actionErrorMessage, useActionMutation } from "@agent-native/core/client/hooks";
import { IconCornerDownLeft } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { TimelineEntry } from "./Timeline";

export function NoteComposer({
  incidentId,
  queryKey,
  userEmail,
  disabled,
}: {
  incidentId: string;
  queryKey: unknown[];
  userEmail: string | null;
  disabled?: boolean;
}) {
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"note" | "hypothesis">("note");
  const ref = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "n" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        ref.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const add = useActionMutation("add-note", {
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      const optimistic: TimelineEntry = {
        id: `pending-${Date.now()}`,
        incidentId,
        kind: input.kind ?? "note",
        body: input.body,
        actorEmail: userEmail,
        actorKind: "person",
        meta: null,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData(queryKey, (old: { timeline: TimelineEntry[] } | undefined) =>
        old ? { ...old, timeline: [...old.timeline, optimistic] } : old,
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(queryKey, (context as { previous?: unknown } | undefined)?.previous);
      toast.error(actionErrorMessage(error) ?? "Could not add the note.");
    },
  });

  function submit() {
    const text = body.trim();
    if (!text || add.isPending) return;
    add.mutate({ incidentId, body: text, kind });
    setBody("");
    setKind("note");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="rounded-lg border border-border bg-card focus-within:border-foreground/40"
    >
      <Textarea
        ref={ref}
        value={body}
        disabled={disabled}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={kind === "hypothesis" ? "What might be causing this?" : "What just happened? Press n to jump here."}
        rows={2}
        maxLength={1000}
        className="min-h-14 resize-none border-0 bg-transparent px-3 py-2.5 text-[13.5px] leading-6 shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Entry kind">
          {(["note", "hypothesis"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={kind === option}
              onClick={() => setKind(option)}
              className={cn(
                "h-7 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                kind === option && "bg-muted text-foreground",
              )}
            >
              {option === "note" ? "Note" : "Hypothesis"}
            </button>
          ))}
        </div>
        <Button type="submit" size="sm" disabled={disabled || !body.trim() || add.isPending}>
          Log it
          <kbd className="ms-1 hidden items-center gap-0.5 font-mono text-[10px] opacity-70 sm:inline-flex">
            ⌘<IconCornerDownLeft className="size-3" />
          </kbd>
        </Button>
      </div>
    </form>
  );
}
