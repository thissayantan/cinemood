import * as SliderPrimitive from "@radix-ui/react-slider";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Slider = forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  const thumbs = Array.isArray(props.defaultValue)
    ? props.defaultValue
    : Array.isArray(props.value)
      ? props.value
      : [props.defaultValue ?? props.value ?? 0];

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-[var(--rule)]">
        <SliderPrimitive.Range className="absolute h-full bg-[var(--accent)]" />
      </SliderPrimitive.Track>
      {(Array.isArray(thumbs) ? thumbs : [thumbs]).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block h-3.5 w-3.5 rounded-full border-2 border-[var(--accent)] bg-[var(--paper)] transition focus-visible:scale-110"
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = "Slider";
