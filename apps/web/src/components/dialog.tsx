import * as DialogPrimitive from "@radix-ui/react-dialog";
import { forwardRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionConfig } from "@/lib/motion";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

interface OverlayProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> {}

export const DialogOverlay = forwardRef<HTMLDivElement, OverlayProps>(
  ({ className, ...props }, ref) => {
    const m = useMotionConfig();
    return (
      <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
          "fixed inset-0 z-40 bg-[var(--paper)]/55",
          className,
        )}
        style={{
          backdropFilter: `blur(${m.blurOpen}px)`,
          WebkitBackdropFilter: `blur(${m.blurOpen}px)`,
        }}
        {...props}
      />
    );
  },
);
DialogOverlay.displayName = "DialogOverlay";

interface ContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Where the panel slides in from. `center` is the default modal; `right`
   * gives a side sheet for mobile filter rails. */
  side?: "center" | "right";
}

export const DialogContent = forwardRef<HTMLDivElement, ContentProps>(
  ({ className, children, side = "center", ...props }, ref) => {
    const m = useMotionConfig();
    const fromCenter = {
      initial: { opacity: 0, scale: 0.96, y: 8 },
      animate: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.97, y: 4 },
    };
    const fromRight = {
      initial: { opacity: 0, x: m.reduced ? 0 : 24 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: m.reduced ? 0 : 16 },
    };
    const isCenter = side === "center";
    const layout = isCenter ? fromCenter : fromRight;

    return (
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          asChild
          onOpenAutoFocus={(e) => e.preventDefault()}
          {...props}
        >
          <motion.div
            initial={layout.initial}
            animate={layout.animate}
            exit={layout.exit}
            transition={
              m.reduced
                ? { duration: 0 }
                : isCenter
                  ? m.springEntry
                  : { duration: m.durMedium, ease: m.easeOutQuint }
            }
            className={cn(
              "fixed z-50 bg-[var(--paper-2)] text-[var(--ink)] shadow-[var(--shadow-card)]",
              isCenter
                ? "left-1/2 top-1/2 w-[min(960px,calc(100vw-32px))] max-h-[calc(100vh-48px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl"
                : "right-0 top-0 h-full w-[88vw] max-w-[420px] overflow-y-auto border-l border-[var(--rule)]",
              className,
            )}
          >
            {children}
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
DialogContent.displayName = "DialogContent";

/** Wrap a Dialog.Root + presence-aware content so the close exit-transition
 *  actually plays. Required `title` is rendered as a visually-hidden
 *  DialogTitle — Radix logs an accessibility warning otherwise, and
 *  callers should label every dialog regardless. Use like:
 *
 *    <Dialog open={open} onOpenChange={setOpen}>
 *      <AnimatedDialogContent open={open} side="center" title="Settings">
 *        ...
 *      </AnimatedDialogContent>
 *    </Dialog>
 */
export function AnimatedDialogContent({
  open,
  side,
  className,
  title,
  description,
  children,
}: {
  open: boolean;
  side?: "center" | "right";
  className?: string;
  /** Accessible name for the dialog. Rendered visually-hidden by default
   *  (sr-only). Pass any string — even a duplicate of an h1 inside the
   *  dialog — so screen readers announce the dialog on open. */
  title: string;
  /** Optional short description, also rendered visually-hidden. */
  description?: string;
  children: React.ReactNode;
}) {
  // Radix Dialog + Framer Motion AnimatePresence has a known timing race:
  // body `pointer-events: none` (set by Radix when modal opens) can stick
  // after close, killing hover/click on the page until the user clicks
  // somewhere. Forcibly clear on close.
  useEffect(() => {
    if (!open && typeof document !== "undefined") {
      const id = window.setTimeout(() => {
        if (document.body.style.pointerEvents === "none") {
          document.body.style.pointerEvents = "";
        }
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <DialogContent side={side} className={className}>
          <DialogPrimitive.Title className="sr-only">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="sr-only">
              {description}
            </DialogPrimitive.Description>
          ) : null}
          {children}
        </DialogContent>
      )}
    </AnimatePresence>
  );
}
