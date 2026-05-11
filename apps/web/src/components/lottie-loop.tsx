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

/** Wraps the LottieFiles player with the §9 contract:
 *  - frozen on the first frame when prefers-reduced-motion is set
 *  - source URL documented in the importing component. */
export function LottieLoop({
  source,
  loop = true,
  size = 240,
  speed = 1,
  className,
}: Props) {
  const reduced = useReducedMotion();
  return (
    <Player
      src={source}
      autoplay={!reduced}
      loop={!reduced && loop}
      speed={reduced ? 0 : speed}
      style={{ width: size, height: size }}
      className={className}
    />
  );
}
