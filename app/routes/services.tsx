import { actionErrorMessage, useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { IconCopy, IconPlayerPause, IconPlayerPlay, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
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
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { clock, dayLabel, relative, useNow } from "@/lib/format";
import { cn } from "@/lib/utils";

import { AgentButton } from "@/components/cordon/AgentButton";
import { HealthDot } from "@/components/cordon/marks";

function AddServiceDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [repo, setRepo] = useState("");
  const [, setSearchParams] = useSearchParams();
  const create = useActionMutation("create-service", {
    onSuccess: (service) => {
      setOpen(false);
      setName("");
      setUrl("");
      setRepo("");
      setSearchParams({ serviceId: service.id });
    },
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Could not add the service."),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" size="sm">Add service</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({ name: name.trim(), url: url.trim(), repo: repo.trim() || undefined, checkIntervalMinutes: 5, isPublic: true });
          }}
        >
          <DialogHeader>
            <DialogTitle>Watch a service</DialogTitle>
            <DialogDescription>Cordon requests the URL every five minutes and opens an incident after two failures in a row.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="svc-name">Name</Label>
            <Input id="svc-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="API" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-url">URL to check</Label>
            <Input id="svc-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/health" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-repo">GitHub repository <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="svc-repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/name" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || !url.trim() || create.isPending}>Add</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceSettings({
  service,
  onSave,
  saving,
}: {
  service: { name: string; url: string; repo: string | null; checkIntervalMinutes: number };
  onSave: (patch: { name?: string; url?: string; repo?: string | null; checkIntervalMinutes?: number }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(service.name);
  const [url, setUrl] = useState(service.url);
  const [repo, setRepo] = useState(service.repo ?? "");
  const [interval, setInterval] = useState(String(service.checkIntervalMinutes));
  const dirty =
    name.trim() !== service.name ||
    url.trim() !== service.url ||
    (repo.trim() || null) !== service.repo ||
    Number(interval) !== service.checkIntervalMinutes;

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const patch: Parameters<typeof onSave>[0] = {};
        if (name.trim() !== service.name) patch.name = name.trim();
        if (url.trim() !== service.url) patch.url = url.trim();
        if ((repo.trim() || null) !== service.repo) patch.repo = repo.trim() || null;
        const minutes = Number(interval);
        if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 60 && minutes !== service.checkIntervalMinutes) {
          patch.checkIntervalMinutes = minutes;
        }
        if (Object.keys(patch).length) onSave(patch);
      }}
    >
      <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Settings</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="svc-edit-name">Name</Label>
          <Input id="svc-edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="svc-edit-url">URL to check</Label>
          <Input id="svc-edit-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="svc-edit-repo">GitHub repository</Label>
          <Input id="svc-edit-repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="svc-edit-interval">Check every (minutes)</Label>
          <Input id="svc-edit-interval" type="number" min={1} max={60} value={interval} onChange={(e) => setInterval(e.target.value)} />
        </div>
      </div>
      {dirty ? (
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={saving || !name.trim() || !url.trim()}>Save changes</Button>
        </div>
      ) : null}
    </form>
  );
}

function ServiceDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const now = useNow();
  const { data, isPending } = useActionQuery("get-service", { id });
  const update = useActionMutation("update-service", {
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Could not update the service."),
  });
  const check = useActionMutation("run-checks", {
    onSuccess: (result) => {
      const first = result.checks[0];
      if (!first) return;
      if (first.ok) toast.success(`Healthy: HTTP ${first.statusCode} in ${first.latencyMs}ms`);
      else toast.warning(`Failing: ${first.error}`);
    },
    onError: (error) => toast.error(actionErrorMessage(error) ?? "Check failed to run."),
  });
  const webhookUrl = data ? `${typeof window !== "undefined" ? window.location.origin : ""}${data.webhookPath}` : "";

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {isPending || !data ? (
          <div className="space-y-3 pt-6"><Skeleton className="h-6 w-40" /><Skeleton className="h-32" /></div>
        ) : (
          <div className="space-y-6">
            <div>
              <SheetTitle className="flex items-center gap-2 text-base">
                <HealthDot ok={data.enabled ? data.lastCheckOk : null} />
                {data.name}
              </SheetTitle>
              <SheetDescription className="mt-1 break-all font-mono text-[11px]">{data.url}</SheetDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={check.isPending} onClick={() => check.mutate({ serviceId: id, force: true })}>
                <IconRefresh className={cn("size-4", check.isPending && "animate-spin")} /> Check now
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => update.mutate({ id, enabled: !data.enabled })}>
                {data.enabled ? <IconPlayerPause className="size-4" /> : <IconPlayerPlay className="size-4" />}
                {data.enabled ? "Pause checks" : "Resume checks"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => update.mutate({ id, isPublic: !data.isPublic })}>
                {data.isPublic ? "Hide from status page" : "Show on status page"}
              </Button>
              {data.openIncidentId ? (
                <Button asChild size="sm" variant="outline"><Link to={`/incidents/${encodeURIComponent(data.openIncidentId)}`}>Open incident</Link></Button>
              ) : null}
            </div>

            <section className="space-y-1.5">
              <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Alert webhook</h3>
              <p className="text-xs text-muted-foreground">POST JSON here from Sentry, Grafana, Better Stack, or curl. Fields like title, message, severity and fingerprint are picked up.</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-[11px]">{webhookUrl}</code>
                <Button type="button" size="icon-sm" variant="outline" aria-label="Copy webhook URL" onClick={() => navigator.clipboard.writeText(webhookUrl).then(() => toast.success("Copied"))}>
                  <IconCopy className="size-4" />
                </Button>
              </div>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Recent checks</h3>
              {data.checks.length ? (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {data.checks.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-2.5 py-1.5 font-mono text-[11px]">
                      <HealthDot ok={c.ok} className="size-2" />
                      <span className="text-muted-foreground">{dayLabel(c.checkedAt)} {clock(c.checkedAt, true)}</span>
                      <span className="ms-auto">{c.ok ? `${c.statusCode} · ${c.latencyMs}ms` : c.error}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No checks yet. Last check {data.lastCheckAt ? relative(data.lastCheckAt, now) : "never"}.</p>
              )}
            </section>

            <ServiceSettings
              key={data.id + data.name + data.url + (data.repo ?? "") + data.checkIntervalMinutes}
              service={data}
              onSave={(patch) => update.mutate({ id, ...patch })}
              saving={update.isPending}
            />

            <AgentButton
              variant="ghost"
              message={`Review the service "${data.name}": is the check URL sensible, is the interval right, and is the repository set?`}
              context={{ serviceId: id }}
            >
              Review with the agent
            </AgentButton>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function ServicesPage() {
  useSetPageTitle("Services");
  const now = useNow();
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get("serviceId");
  const { data, isPending } = useActionQuery("list-services", {});
  const page = useActionQuery("get-status-page-for-workspace", {});

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <div className="mb-4 flex justify-end">
        <AddServiceDialog />
      </div>

      {isPending ? (
        <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
      ) : data?.services.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {data.services.map((service) => (
            <li key={service.id}>
              <button
                type="button"
                onClick={() => setSearchParams({ serviceId: service.id })}
                className="flex w-full items-center gap-3 px-3 py-3 text-start hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <HealthDot ok={service.enabled ? service.lastCheckOk : null} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{service.name}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">{service.url}</span>
                </span>
                <span className="text-end font-mono text-[11px] text-muted-foreground">
                  {!service.enabled ? "paused" : service.lastCheckAt ? relative(service.lastCheckAt, now) : "not checked"}
                  <span className="block">every {service.checkIntervalMinutes}m</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing watched yet. Add a service, or tell the agent what to watch.
        </div>
      )}

      <section className="mt-8 rounded-lg border border-border p-4">
        <h2 className="mb-1 text-sm font-medium">Public status page</h2>
        {page.data?.page ? (
          <p className="text-sm text-muted-foreground">
            Live at{" "}
            <a href={`/status/${page.data.page.slug}`} target="_blank" rel="noreferrer" className="font-mono text-foreground underline-offset-2 hover:underline">
              /status/{page.data.page.slug}
            </a>
            . Public services and published updates appear there.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">Not set up. Customers have nowhere to look yet.</p>
            <AgentButton message="Create the public status page for this workspace. Ask me for the product name first." submit={false}>
              Set it up
            </AgentButton>
          </div>
        )}
      </section>

      {selected ? <ServiceDrawer id={selected} onClose={() => setSearchParams({})} /> : null}
    </div>
  );
}
