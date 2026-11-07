import { useActionQuery } from "@agent-native/core/client/hooks";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { useParams } from "react-router";

import { duration, useNow } from "@/lib/format";
import { cn } from "@/lib/utils";

import { SEVERITY_LABEL, STATUS_LABEL } from "../../shared/incident";
import { UptimeBars } from "@/components/cordon/UptimeBars";

// Catch up after a stalled frame instead of stretching the intro, so content
// is never left hidden in a tab that was not being painted.
gsap.ticker.lagSmoothing(0);

export function meta({ params }: { params: { slug?: string } }) {
  return [{ title: `${params.slug ?? "Status"} · status` }];
}

function when(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export default function PublicStatusPage() {
  const { slug = "" } = useParams();
  const now = useNow();
  const root = useRef<HTMLElement>(null);
  const { data, isPending, error } = useActionQuery("get-status-page", { slug }, { refetchInterval: 60_000 });
  const ready = Boolean(data);

  useGSAP(
    () => {
      if (!ready || document.visibilityState !== "visible") return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .from("[data-label]", { y: 10, opacity: 0, duration: 0.4 })
          .from("[data-banner]", { clipPath: "inset(0 100% 0 0 round 8px)", duration: 0.85, ease: "power3.inOut" }, "-=0.15")
          .from("[data-banner-text]", { x: -14, opacity: 0, duration: 0.45 }, "-=0.4")
          .from("[data-rise]", { y: 24, opacity: 0, duration: 0.6, stagger: 0.09 }, "-=0.2");
      });
      return () => media.revert();
    },
    { scope: root, dependencies: [ready] },
  );

  return (
    <main ref={root} className="status-page min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Loading</p>
        ) : error || !data ? (
          <p className="text-sm text-muted-foreground">This status page does not exist.</p>
        ) : (
          <>
            <header className="mb-8">
              <p data-label className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{data.title}</p>
              <div
                data-banner
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3.5",
                  data.allClear
                    ? "border-[hsl(var(--signal-moss)/0.5)] bg-[hsl(var(--signal-moss)/0.08)]"
                    : "border-[hsl(var(--signal-ember)/0.5)] bg-[hsl(var(--signal-ember)/0.08)]",
                )}
              >
                <span className="relative flex size-3">
                  <span
                    className={cn(
                      "absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden",
                      data.allClear ? "bg-[hsl(var(--signal-moss))]" : "bg-[hsl(var(--signal-ember))]",
                    )}
                    style={{ animationDuration: data.allClear ? "2.6s" : "1.2s" }}
                  />
                  <span className={cn("relative size-3 rounded-full", data.allClear ? "bg-[hsl(var(--signal-moss))]" : "bg-[hsl(var(--signal-ember))]")} />
                </span>
                <h1 data-banner-text className="text-lg font-semibold">
                  {data.allClear ? "All systems operational" : `${data.open.length} active incident${data.open.length === 1 ? "" : "s"}`}
                </h1>
              </div>
            </header>

            {data.open.length ? (
              <section className="mb-10 space-y-5">
                {data.open.map((incident) => (
                  <article key={incident.id} data-rise className="rounded-lg border border-border p-4">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{STATUS_LABEL[incident.status]}</span>
                      <span>·</span>
                      <span>{SEVERITY_LABEL[incident.severity]}</span>
                      {incident.serviceName ? <><span>·</span><span>{incident.serviceName}</span></> : null}
                      <span className="ms-auto tabular-nums">{duration(incident.startedAt, null, now)} so far</span>
                    </div>
                    <h2 className="text-base font-medium">{incident.title}</h2>
                    <ol className="mt-3 space-y-3 border-s border-border ps-4">
                      {incident.updates.map((update) => (
                        <li key={update.id}>
                          <p className="text-[11px] text-muted-foreground">{STATUS_LABEL[update.state]} · {when(update.publishedAt)}</p>
                          <p className="text-sm leading-6">{update.body}</p>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </section>
            ) : null}

            <section data-rise className="mb-10">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Services</h2>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {data.services.map((service) => (
                  <li key={service.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{service.name}</span>
                    <UptimeBars checks={service.checks} slots={40} className="hidden h-7 sm:flex" />
                    <span className={cn("w-24 text-end text-xs", service.ok === false ? "text-[hsl(var(--signal-ember))]" : "text-[hsl(var(--signal-moss))]")}>
                      {service.ok === null ? "Not checked yet" : service.ok ? "Operational" : "Degraded"}
                    </span>
                  </li>
                ))}
                {data.services.length === 0 ? <li className="px-4 py-2.5 text-sm text-muted-foreground">No public services listed.</li> : null}
              </ul>
            </section>

            {data.recent.length ? (
              <section data-rise>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Past 7 days</h2>
                <ul className="space-y-4">
                  {data.recent.map((incident) => (
                    <li key={incident.id}>
                      <p className="text-sm font-medium">{incident.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Resolved {when(incident.resolvedAt)} · lasted {duration(incident.startedAt, incident.resolvedAt)}
                      </p>
                      {incident.updates[0] ? <p className="mt-1 text-sm leading-6 text-foreground/85">{incident.updates[0].body}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <footer data-rise className="mt-14 text-[11px] text-muted-foreground">Updated {when(data.generatedAt)}</footer>
          </>
        )}
      </div>
    </main>
  );
}
