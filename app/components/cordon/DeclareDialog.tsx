import { actionErrorMessage, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { SEVERITIES, SEVERITY_LABEL, type Severity } from "../../../shared/incident";
import { severityTone } from "./marks";

export function SeverityPicker({ value, onChange }: { value: Severity; onChange: (s: Severity) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Severity">
      {SEVERITIES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          className={cn(
            "flex h-14 flex-col items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground",
            value === s && severityTone(s),
          )}
        >
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em]">{s}</span>
          <span className="text-[11px]">{SEVERITY_LABEL[s]}</span>
        </button>
      ))}
    </div>
  );
}

export function DeclareDialog({ trigger, defaultServiceId }: { trigger: ReactNode; defaultServiceId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<Severity>("sev2");
  const [serviceId, setServiceId] = useState<string>(defaultServiceId ?? "");
  const navigate = useNavigate();
  const services = useActionQuery("list-services", {}, { enabled: open });
  const declare = useActionMutation("declare-incident", {
    onSuccess: (incident) => {
      setOpen(false);
      setTitle("");
      navigate(`/incidents/${encodeURIComponent(incident.id)}`);
    },
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Could not open the incident."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            declare.mutate({ title: title.trim(), severity, serviceId: serviceId || undefined });
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Declare an incident</DialogTitle>
            <DialogDescription>Say what is broken the way a customer would. You can change everything later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="declare-title">What is broken</Label>
            <Input id="declare-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} placeholder="Checkout returns 500 for card payments" />
          </div>
          <div className="space-y-1.5">
            <Label>Severity</Label>
            <SeverityPicker value={severity} onChange={setSeverity} />
          </div>
          {services.data?.services.length ? (
            <div className="space-y-1.5">
              <Label htmlFor="declare-service">Service</Label>
              <select
                id="declare-service"
                value={serviceId}
                onChange={(event) => setServiceId(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Not tied to a service</option>
                {services.data.services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!title.trim() || declare.isPending}>
              {declare.isPending ? "Opening" : "Declare"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
