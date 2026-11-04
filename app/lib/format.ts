import { useEffect, useState } from "react";

export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function relative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const diff = Math.max(0, now - Date.parse(iso));
  const s = Math.round(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function duration(fromIso: string, toIso?: string | null, now = Date.now()): string {
  const from = Date.parse(fromIso);
  const to = toIso ? Date.parse(toIso) : now;
  const total = Math.max(0, Math.round((to - from) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0 && m === 0) return `${total}s`;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function clock(iso: string | null | undefined, withSeconds = false): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12: false,
  }).format(new Date(iso));
}

export function utcClock(iso: string | null | undefined): string {
  if (!iso) return "";
  return `${iso.slice(11, 16)} UTC`;
}

export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
}

export function initials(email: string | null | undefined): string {
  if (!email) return "";
  const name = email.split("@")[0] ?? email;
  const parts = name.split(/[._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || name.slice(0, 2).toUpperCase();
}
