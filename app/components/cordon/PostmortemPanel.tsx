import { actionErrorMessage, useActionMutation } from "@agent-native/core/client/hooks";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { dayLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

import { AgentButton } from "./AgentButton";

export interface ActionItem {
  id: string;
  incidentId: string;
  title: string;
  assigneeEmail: string | null;
  dueAt: string | null;
  done: boolean;
  createdAt: string;
}

type Field = "summary" | "impact" | "rootCause" | "lessons";
const FIELDS: Array<{ key: Field; label: string; hint: string }> = [
  { key: "summary", label: "Summary", hint: "Two sentences. What happened and how it ended." },
  { key: "impact", label: "Impact", hint: "Who was affected, how, and for how long. UTC window." },
  { key: "rootCause", label: "Root cause", hint: "The mechanism and the contributing factors. No names." },
  { key: "lessons", label: "Lessons", hint: "What went well, what was slow, what was lucky." },
];

function FieldEditor({
  incidentId,
  field,
  label,
  hint,
  value,
}: {
  incidentId: string;
  field: Field;
  label: string;
  hint: string;
  value: string | null;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setDraft(value ?? "");
  }, [value, dirty]);
  const save = useActionMutation("update-incident", {
    onSuccess: () => setDirty(false),
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Could not save."),
  });

  return (
    <section className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{label}</h3>
        {dirty ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={save.isPending}
            onClick={() => save.mutate({ id: incidentId, [field]: draft.trim() || null })}
          >
            Save
          </Button>
        ) : null}
      </div>
      <Textarea
        value={draft}
        placeholder={hint}
        rows={field === "rootCause" ? 6 : 3}
        onChange={(event) => {
          setDraft(event.target.value);
          setDirty(true);
        }}
        onBlur={() => {
          if (dirty && draft.trim() !== (value ?? "").trim()) {
            save.mutate({ id: incidentId, [field]: draft.trim() || null });
          }
        }}
        className="text-[13.5px] leading-6"
      />
    </section>
  );
}

export function PostmortemPanel({
  incident,
  actionItems,
}: {
  incident: { id: string; status: string; summary: string | null; impact: string | null; rootCause: string | null; lessons: string | null };
  actionItems: ActionItem[];
}) {
  const [title, setTitle] = useState("");
  const add = useActionMutation("add-action-item", {
    onSuccess: () => setTitle(""),
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Could not add the item."),
  });
  const toggle = useActionMutation("update-action-item", {
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Could not update the item."),
  });
  const resolved = incident.status === "resolved";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <AgentButton
          message="Write the postmortem for this incident from its timeline: summary, impact, root cause, lessons, and action items."
          context={{ incidentId: incident.id }}
          submit={resolved}
        >
          {resolved ? "Write it with the agent" : "Prepare with the agent"}
        </AgentButton>
        {!resolved ? (
          <span className="text-xs text-muted-foreground">Usually written after all clear. Fields save as you go.</span>
        ) : null}
      </div>

      {FIELDS.map((f) => (
        <FieldEditor key={f.key} incidentId={incident.id} field={f.key} label={f.label} hint={f.hint} value={incident[f.key]} />
      ))}

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Action items</h3>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {actionItems.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-3 py-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                aria-label={item.done ? "Mark not done" : "Mark done"}
                onClick={() => toggle.mutate({ id: item.id, done: !item.done })}
                className={cn(
                  "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded border border-border transition-colors",
                  item.done && "border-[hsl(var(--signal-moss))] bg-[hsl(var(--signal-moss))] text-background",
                )}
              >
                {item.done ? <IconCheck className="size-3" /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13.5px] leading-5", item.done && "text-muted-foreground line-through")}>{item.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {item.assigneeEmail ?? "Unassigned"}
                  {item.dueAt ? ` · due ${dayLabel(item.dueAt)}` : ""}
                </p>
              </div>
            </li>
          ))}
          <li className="px-3 py-2">
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (title.trim()) add.mutate({ incidentId: incident.id, title: title.trim() });
              }}
            >
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a follow-up" maxLength={200} className="h-8 text-[13px]" />
              <Button type="submit" size="icon-sm" variant="outline" aria-label="Add action item" disabled={!title.trim() || add.isPending}>
                <IconPlus className="size-4" />
              </Button>
            </form>
          </li>
        </ul>
      </section>
    </div>
  );
}
