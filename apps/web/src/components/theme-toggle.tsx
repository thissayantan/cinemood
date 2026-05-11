import { useTheme, type ThemePref } from "@/lib/theme";

const LABEL: Record<ThemePref, string> = {
  system: "Auto",
  light: "Light",
  dark: "Dark",
};

export function ThemeToggle() {
  const { pref, cycle } = useTheme();
  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${LABEL[pref]} — click to cycle`}
      aria-label={`Theme: ${LABEL[pref]}`}
      className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-3 font-mono text-[11px] uppercase tracking-wider text-[var(--paper-dim)] transition hover:text-[var(--ink)]"
    >
      <Glyph pref={pref} />
      <span>{LABEL[pref]}</span>
    </button>
  );
}

function Glyph({ pref }: { pref: ThemePref }) {
  switch (pref) {
    case "light":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
          <circle
            cx="12"
            cy="12"
            r="4.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M12 3v2.5" />
            <path d="M12 18.5V21" />
            <path d="M3 12h2.5" />
            <path d="M18.5 12H21" />
            <path d="M5.3 5.3l1.8 1.8" />
            <path d="M16.9 16.9l1.8 1.8" />
            <path d="M5.3 18.7l1.8-1.8" />
            <path d="M16.9 7.1l1.8-1.8" />
          </g>
        </svg>
      );
    case "dark":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M20.5 14.2A8.5 8.5 0 1 1 10.4 4a.6.6 0 0 1 .7.7 6.7 6.7 0 0 0 8.7 8.7.6.6 0 0 1 .7.7Z"
          />
        </svg>
      );
    case "system":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
        </svg>
      );
  }
}
