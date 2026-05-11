export interface ProviderRow {
  name: string;
  logo: string | null;
}

/** Extract the `flatrate` array from a TMDB region payload, or `[]`. */
function flatrateOf(region: unknown): unknown[] {
  if (!region || typeof region !== "object") return [];
  const flat = (region as Record<string, unknown>).flatrate;
  return Array.isArray(flat) ? flat : [];
}

/** Coerce a TMDB provider entry into a ProviderRow, or null. */
function toRow(entry: unknown): ProviderRow | null {
  if (!entry || typeof entry !== "object") return null;
  const r = entry as { provider_name?: string; logo_path?: string };
  if (!r.provider_name) return null;
  return { name: r.provider_name, logo: r.logo_path ?? null };
}

function rowsForRegion(
  providers: Record<string, unknown>,
  code: string,
): ProviderRow[] {
  return flatrateOf(providers[code])
    .map(toRow)
    .filter((x): x is ProviderRow => x !== null);
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

  const inRegion = rowsForRegion(providers, "IN");
  if (inRegion.length > 0) return inRegion.slice(0, limit);

  const us = rowsForRegion(providers, "US");
  if (us.length > 0) return us.slice(0, limit);

  // Union across all regions, deduped by provider name.
  const seen = new Set<string>();
  const out: ProviderRow[] = [];
  for (const region of Object.values(providers)) {
    for (const entry of flatrateOf(region)) {
      const row = toRow(entry);
      if (!row || seen.has(row.name)) continue;
      seen.add(row.name);
      out.push(row);
    }
  }
  return out.slice(0, limit);
}
