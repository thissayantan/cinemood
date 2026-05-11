import * as SliderPrimitive from "@radix-ui/react-slider";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

function resolveThumbs(
  value: number | number[] | readonly number[] | undefined,
  defaultValue: number | number[] | readonly number[] | undefined,
): ReadonlyArray<number> {
  if (Array.isArray(defaultValue)) return defaultValue;
  if (Array.isArray(value)) return value;
  const single = (defaultValue as number | undefined) ?? (value as number | undefined) ?? 0;
  return [single];
}

export const Slider = forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  const thumbs = resolveThumbs(props.value, props.defaultValue);

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
      {thumbs.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block h-3.5 w-3.5 rounded-full border-2 border-[var(--accent)] bg-[var(--paper)] transition focus-visible:scale-110"
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = "Slider";
