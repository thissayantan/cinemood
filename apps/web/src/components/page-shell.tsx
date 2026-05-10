import type { PropsWithChildren } from "react";

export function PageShell({ children }: PropsWithChildren) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(167,139,250,0.32),transparent_55%),radial-gradient(circle_at_85%_70%,rgba(34,211,238,0.25),transparent_60%)]"
        aria-hidden
      />
      {children}
    </div>
  );
}
