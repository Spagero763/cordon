import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function EditableTitle({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (next: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== value) onSave(next);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        maxLength={140}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        aria-label="Incident title"
        className={cn(
          "w-full rounded-md border border-border bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      />
    );
  }
  return (
    <h1
      className={cn("group cursor-text rounded-md px-2 py-1 -mx-2 hover:bg-muted/50", className)}
      title="Click to rename"
      onClick={() => setEditing(true)}
    >
      {value}
    </h1>
  );
}
