export interface ProviderRow {
  name: string;
  logo: string | null;
}

/** Pick the streaming providers (flatrate) for the user's region, falling
 *  back to US, then to the union across regions if neither has any. We
 *  prefer subscription (flatrate) over rent/buy since the user is browsing
 *  "what's available to watch", not the store. */
export function selectProviders(
  providers: Record<string, unknown> | null | undefined,
  limit = 6,
): ProviderRow[] {
  if (!providers) return [];
  const tryRegion = (code: string): ProviderRow[] => {
    const region = (providers as Record<string, unknown>)[code];
    if (!region || typeof region !== "object") return [];
    const flat = (region as Record<string, unknown>).flatrate;
    if (!Array.isArray(flat)) return [];
    return (flat as unknown[])
      .map((p) => {
        if (!p || typeof p !== "object") return null;
        const r = p as { provider_name?: string; logo_path?: string };
        if (!r.provider_name) return null;
        return { name: r.provider_name, logo: r.logo_path ?? null };
      })
      .filter((x): x is ProviderRow => Boolean(x));
  };
  const inRegion = tryRegion("IN");
  if (inRegion.length > 0) return inRegion.slice(0, limit);
  const us = tryRegion("US");
  if (us.length > 0) return us.slice(0, limit);
  // Union across all regions, deduped by provider name.
  const seen = new Set<string>();
  const out: ProviderRow[] = [];
  for (const region of Object.values(providers)) {
    if (!region || typeof region !== "object") continue;
    const flat = (region as Record<string, unknown>).flatrate;
    if (!Array.isArray(flat)) continue;
    for (const p of flat as unknown[]) {
      if (!p || typeof p !== "object") continue;
      const r = p as { provider_name?: string; logo_path?: string };
      if (!r.provider_name || seen.has(r.provider_name)) continue;
      seen.add(r.provider_name);
      out.push({ name: r.provider_name, logo: r.logo_path ?? null });
    }
  }
  return out.slice(0, limit);
}
