import { kvPutSafe } from "./kv-safe";

const OMDB_BASE = "https://www.omdbapi.com/";
const OMDB_TTL = 60 * 60 * 24 * 30; // 30 days

interface OmdbResponse {
  Response?: "True" | "False";
  imdbRating?: string;
  Error?: string;
}

export async function fetchOmdbRating(
  apiKey: string,
  cache: KVNamespace,
  imdbId: string,
): Promise<number | null> {
  if (!imdbId) return null;
  // OMDB is an optional dependency — used only for the IMDb-rating
  // fallback shown alongside the TMDB rating. On a fresh fork without
  // an OMDB key, skip the upstream call entirely (returning null) so
  // title detail fetches still succeed; the title card just shows the
  // TMDB rating alone. Logging an upstream "Bad Request" for every
  // detail load would be noisy and misleading.
  if (!apiKey || !apiKey.trim()) return null;
  const cacheKey = `omdb:imdb:${imdbId}`;
  const cached = await cache.get(cacheKey);
  if (cached !== null) {
    return cached === "" ? null : Number(cached);
  }

  const url = new URL(OMDB_BASE);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("apikey", apiKey);

  let rating: number | null = null;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const json = (await res.json()) as OmdbResponse;
      if (json.Response === "True" && json.imdbRating && json.imdbRating !== "N/A") {
        const n = Number(json.imdbRating);
        if (!Number.isNaN(n)) rating = n;
      }
    }
  } catch (err) {
    console.error("omdb fetch failed", err);
  }

  await kvPutSafe(cache, cacheKey, rating === null ? "" : String(rating), {
    expirationTtl: OMDB_TTL,
  });
  return rating;
}
