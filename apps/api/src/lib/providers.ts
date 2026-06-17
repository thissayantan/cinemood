/**
 * providers.ts — server-side TMDB provider helpers.
 *
 * Mirrors the logic in apps/web/src/lib/providers.ts but returns plain names
 * (strings) rather than {name, logo} rows, since the API doesn't serve logos.
 */

function flatrateOf(region: unknown): unknown[] {
  if (!region || typeof region !== "object") return [];
  const flat = (region as Record<string, unknown>).flatrate;
  return Array.isArray(flat) ? flat : [];
}

function nameOf(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const r = entry as { provider_name?: string };
  return r.provider_name ?? null;
}

function namesForRegion(providers: Record<string, unknown>, code: string): string[] {
  return flatrateOf(providers[code])
    .map(nameOf)
    .filter((x): x is string => x !== null);
}

/**
 * Return an array of streaming provider names (flatrate) for the title.
 * Prefers IN, then US, then deduped union. Returns [] for null providers.
 */
export function selectProviderNames(
  providers: Record<string, unknown> | null | undefined,
  limit = 6,
): string[] {
  if (!providers) return [];

  const inRegion = namesForRegion(providers, "IN");
  if (inRegion.length > 0) return inRegion.slice(0, limit);

  const us = namesForRegion(providers, "US");
  if (us.length > 0) return us.slice(0, limit);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const region of Object.values(providers)) {
    for (const entry of flatrateOf(region)) {
      const name = nameOf(entry);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
  }
  return out.slice(0, limit);
}
