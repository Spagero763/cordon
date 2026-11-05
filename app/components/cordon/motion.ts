import type { Transition, Variants } from "motion/react";

export const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const spring: Transition = { type: "spring", stiffness: 420, damping: 32, mass: 0.8 };

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

export const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease } },
};
