import { useCallback, useState } from "react";

const STORAGE_KEY = "cinemood_region";

export const REGIONS: { code: string; name: string }[] = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
];

function readRegion(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "IN";
  } catch {
    return "IN";
  }
}

export function useRegion() {
  const [region, setRegionState] = useState<string>(readRegion);

  const setRegion = useCallback((code: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore storage errors
    }
    setRegionState(code);
  }, []);

  return { region, setRegion };
}

export function pickProviders(
  providers: Record<string, unknown> | null,
  region: string,
): string[] {
  if (!providers) return [];
  const regionData = providers[region] ?? providers["US"];
  if (!regionData || typeof regionData !== "object") return [];
  const out = new Set<string>();
  for (const bucket of Object.values(regionData as Record<string, unknown>)) {
    if (!Array.isArray(bucket)) continue;
    for (const entry of bucket) {
      if (!entry || typeof entry !== "object") continue;
      const name = (entry as { provider_name?: unknown }).provider_name;
      if (typeof name === "string") out.add(name);
    }
  }
  return [...out];
}
