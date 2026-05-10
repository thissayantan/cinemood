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
      title={`Theme: ${LABEL[pref]} (click to cycle)`}
      aria-label={`Theme: ${LABEL[pref]}`}
      className="flex h-8 items-center gap-1.5 rounded-full border border-black/10 bg-black/5 px-3 text-xs text-black/70 transition hover:bg-black/10 dark:border-white/15 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
    >
      <Glyph pref={pref} />
      <span>{LABEL[pref]}</span>
    </button>
  );
}

function Glyph({ pref }: { pref: ThemePref }) {
  if (pref === "light") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M12 4a1 1 0 0 1 1 1V7a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm0 13a5 5 0 1 1 0-10a5 5 0 0 1 0 10Zm0 1a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1ZM4 12a1 1 0 0 1 1-1H7a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm13 0a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1ZM6.34 6.34a1 1 0 0 1 1.42 0l1.41 1.41a1 1 0 1 1-1.41 1.42L6.34 7.76a1 1 0 0 1 0-1.42Zm8.49 8.49a1 1 0 0 1 1.41 0l1.42 1.41a1 1 0 1 1-1.42 1.42l-1.41-1.42a1 1 0 0 1 0-1.41Zm0-7.08l1.41-1.41a1 1 0 1 1 1.42 1.42l-1.42 1.41a1 1 0 1 1-1.41-1.42ZM6.34 17.66l1.41-1.42a1 1 0 1 1 1.42 1.42l-1.41 1.41a1 1 0 1 1-1.42-1.41Z"
        />
      </svg>
    );
  }
  if (pref === "dark") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 3a9 9 0 0 0 0 18zm0 16V5a7 7 0 0 1 0 14"
      />
    </svg>
  );
}
