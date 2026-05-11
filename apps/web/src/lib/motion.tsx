import { createContext, useContext } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * One-stop motion configuration. Reads `useReducedMotion()` ONCE at the App
 * root and exposes a frozen config object that every motion site reads via
 * `useMotionConfig()`. No motion site hardcodes its own transition.
 *
 * §9 of claude-instructions.md is the authority on these numbers.
 */

export interface MotionConfig {
  reduced: boolean;

  // Component-level durations (seconds, for framer-motion).
  durFast: number;     // 0.15s — card hover / chip
  durBase: number;     // 0.20s — page / dialog cross-fade
  durMedium: number;   // 0.22s — modal open spring window
  durSlow: number;     // 0.25s — theme toggle / watched draw-in
  durToastIn: number;  // 0.20s
  durToastOut: number; // 0.15s

  // Spring used for entrances + modal open.
  springEntry: { type: "spring"; stiffness: number; damping: number };

  // Tween easing for cross-fades and chip/route transitions.
  easeOutQuint: [number, number, number, number];
  easeInQuint: [number, number, number, number];

  // Grid stagger (seconds per item). Capped via `staggerCap`.
  staggerPerItem: number;
  staggerCap: number;

  // Y offset for fade-up entrances (pixels).
  fadeY: number;

  // Scale for hover lift.
  scaleHover: number;

  // Backdrop blur for dialogs (px). Animated from 0 → blurOpen.
  blurOpen: number;
}

const ACTIVE: MotionConfig = {
  reduced: false,
  durFast: 0.15,
  durBase: 0.2,
  durMedium: 0.22,
  durSlow: 0.25,
  durToastIn: 0.2,
  durToastOut: 0.15,
  springEntry: { type: "spring", stiffness: 240, damping: 24 },
  easeOutQuint: [0.16, 1, 0.3, 1],
  easeInQuint: [0.4, 0, 1, 1],
  staggerPerItem: 0.06,
  staggerCap: 0.24,
  fadeY: 8,
  scaleHover: 1.015,
  blurOpen: 14,
};

const REDUCED: MotionConfig = {
  reduced: true,
  durFast: 0,
  durBase: 0,
  durMedium: 0,
  durSlow: 0,
  durToastIn: 0,
  durToastOut: 0,
  springEntry: { type: "spring", stiffness: 600, damping: 60 },
  easeOutQuint: [0.16, 1, 0.3, 1],
  easeInQuint: [0.4, 0, 1, 1],
  staggerPerItem: 0,
  staggerCap: 0,
  fadeY: 0,
  scaleHover: 1,
  blurOpen: 0,
};

const Ctx = createContext<MotionConfig>(ACTIVE);

export function MotionConfigProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const reduced = useReducedMotion() ?? false;
  const value = reduced ? REDUCED : ACTIVE;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMotionConfig(): MotionConfig {
  return useContext(Ctx);
}

/** Helper for grid stagger delay given an item index. */
export function staggerDelay(index: number, m: MotionConfig): number {
  return Math.min(index * m.staggerPerItem, m.staggerCap);
}
