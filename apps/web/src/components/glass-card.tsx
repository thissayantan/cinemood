import type { HTMLAttributes, PropsWithChildren } from "react";

type Props = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export function GlassCard({ className = "", children, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={
        "rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] " +
        className
      }
    >
      {children}
    </div>
  );
}
