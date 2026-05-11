import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { forwardRef } from "react";
import { motion } from "framer-motion";
import { useMotionConfig } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const HoverCard = HoverCardPrimitive.Root;
export const HoverCardTrigger = HoverCardPrimitive.Trigger;

interface ContentProps
  extends React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content> {}

export const HoverCardContent = forwardRef<HTMLDivElement, ContentProps>(
  ({ className, align = "start", side = "right", sideOffset = 12, ...props }, ref) => {
    const m = useMotionConfig();
    return (
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          ref={ref}
          align={align}
          side={side}
          sideOffset={sideOffset}
          collisionPadding={16}
          className={cn(
            "z-50 outline-none",
            // Radix sets data-state=open/closed and data-side; we let
            // framer-motion handle the entrance below.
            className,
          )}
          asChild
          {...props}
        >
          <motion.div
            initial={
              m.reduced ? false : { opacity: 0, scale: 0.97, y: 4 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={
              m.reduced
                ? { duration: 0 }
                : { duration: m.durBase, ease: m.easeOutQuint }
            }
          >
            {props.children}
          </motion.div>
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    );
  },
);
HoverCardContent.displayName = "HoverCardContent";
