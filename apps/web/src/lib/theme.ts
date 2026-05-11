import { useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";
const STORAGE_KEY = "cm_theme";

function applyTheme(pref: ThemePref) {
  const dark =
    pref === "dark" ||
    (pref === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function readPref(): ThemePref {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

export function useTheme(): {
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  cycle: () => void;
} {
  const [pref, setPrefState] = useState<ThemePref>(() => readPref());

  useEffect(() => {
    applyTheme(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* ignore */
    }
  }, [pref]);

  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [pref]);

  function cycle() {
    setPrefState(nextPref);
  }

  return { pref, setPref: setPrefState, cycle };
}

function nextPref(current: ThemePref): ThemePref {
  switch (current) {
    case "system":
      return "light";
    case "light":
      return "dark";
    case "dark":
      return "system";
  }
}
