import { Dialog, AnimatedDialogContent } from "./dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

/** Mobile filter rail / side-sheet. Reuses the dialog primitive with side="right". */
export function Sheet({ open, onOpenChange, children, className }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatedDialogContent open={open} side="right" className={className}>
        {children}
      </AnimatedDialogContent>
    </Dialog>
  );
}
