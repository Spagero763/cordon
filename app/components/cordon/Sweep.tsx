import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

gsap.ticker.lagSmoothing(0);

/**
 * A wash of colour across the top of the page when the room changes state:
 * ember when something opens, moss when the last thing clears.
 */
export function Sweep({ open }: { open: number | null }) {
  const bar = useRef<HTMLDivElement>(null);
  const previous = useRef<number | null>(null);

  useGSAP(
    () => {
      if (open === null) return;
      const before = previous.current;
      previous.current = open;
      const el = bar.current;
      if (before === null || before === open || !el) return;
      const opened = open > before;
      const cleared = open === 0 && before > 0;
      if (!opened && !cleared) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      el.style.setProperty("--sweep", opened ? "var(--signal-ember)" : "var(--signal-moss)");
      gsap
        .timeline()
        .set(el, { xPercent: -100, opacity: 1 })
        .to(el, { xPercent: 100, duration: opened ? 0.95 : 1.5, ease: "power3.inOut" })
        .set(el, { opacity: 0 });
    },
    { dependencies: [open] },
  );

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-20 h-40 overflow-hidden">
      <div ref={bar} className="cordon-sweep h-full w-full opacity-0" />
    </div>
  );
}
