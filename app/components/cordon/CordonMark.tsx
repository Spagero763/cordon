import { cn } from "@/lib/utils";

export function CordonMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("size-6", className)}>
      <defs>
        <clipPath id="cordon-mark-clip">
          <rect width="64" height="64" rx="14" />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx="14" className="fill-sidebar-accent-foreground/10" />
      <g clipPath="url(#cordon-mark-clip)" fill="hsl(var(--signal-ember))">
        <path d="M-8 44 L44 -8 L58 -8 L-8 58 Z" />
        <path d="M20 72 L72 20 L72 34 L34 72 Z" />
      </g>
    </svg>
  );
}
