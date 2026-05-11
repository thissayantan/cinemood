import { useEffect, useMemo, useState } from "react";
import { Player } from "@lottiefiles/react-lottie-player";
import { useReducedMotion } from "framer-motion";

interface Props {
  /** Imported JSON or URL to the Lottie JSON. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  source: any;
  /** Loop the animation (steady state). Welcome / success Lotties pass false. */
  loop?: boolean;
  /** Pixel size — applied to both width and height. */
  size?: number;
  speed?: number;
  className?: string;
}

// The cream/paper colour used by our in-repo Lottie sources, in the
// 0..1 normalised RGB Lottie uses. Anything matching this within a
// small tolerance gets re-tinted to ink for light-mode display so the
// animation isn't cream-on-cream and effectively invisible.
const CREAM_RGB = [0.949, 0.921, 0.866] as const;
const INK_LIGHT = [0.102, 0.094, 0.078] as const; // #1A1814

function isCream(c: number[]): boolean {
  return (
    c.length >= 3 &&
    Math.abs(c[0]! - CREAM_RGB[0]) < 0.05 &&
    Math.abs(c[1]! - CREAM_RGB[1]) < 0.05 &&
    Math.abs(c[2]! - CREAM_RGB[2]) < 0.05
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function recolor(node: any): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) recolor(item);
    return;
  }
  // A Lottie colour property looks like { a: 0, k: [r, g, b, a] }.
  // Keyframed colours nest the array deeper but our placeholder reel
  // uses the constant shape — keep it simple.
  if (
    "k" in node &&
    Array.isArray(node.k) &&
    typeof node.k[0] === "number" &&
    isCream(node.k as number[])
  ) {
    node.k = [INK_LIGHT[0], INK_LIGHT[1], INK_LIGHT[2], node.k[3] ?? 1];
  }
  for (const key of Object.keys(node)) recolor(node[key]);
}

function useEffectiveTheme(): "light" | "dark" {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true,
  );
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);
  return isDark ? "dark" : "light";
}

/** Wraps the LottieFiles player with the §9 contract:
 *  - frozen on the first frame when prefers-reduced-motion is set
 *  - source URL documented in the importing component
 *  - in light mode, swaps any cream-coloured fills to ink so the
 *    animation doesn't disappear into the cream paper background. */
export function LottieLoop({
  source,
  loop = true,
  size = 240,
  speed = 1,
  className,
}: Props) {
  const reduced = useReducedMotion();
  const theme = useEffectiveTheme();
  const src = useMemo(() => {
    if (theme === "dark") return source;
    const cloned = structuredClone(source);
    recolor(cloned);
    return cloned;
  }, [source, theme]);
  return (
    <Player
      src={src}
      autoplay={!reduced}
      loop={!reduced && loop}
      speed={reduced ? 0 : speed}
      style={{ width: size, height: size }}
      className={className}
    />
  );
}
