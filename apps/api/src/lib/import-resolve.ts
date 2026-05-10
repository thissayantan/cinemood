import type { TitleType } from "@cinemood/shared";
import type { Env } from "../env";
import { searchTmdb, type TmdbSearchResult } from "./tmdb";

export interface ImportCandidate {
  raw: string;
  title: string;
  year?: number;
  type?: TitleType;
}

export type ResolveStatus = "matched" | "ambiguous" | "unmatched";

export interface ResolvedHit {
  raw: string;
  status: ResolveStatus;
  confidence: number;
  best?: TmdbSearchResult;
  alternatives: TmdbSearchResult[];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function score(
  cand: ImportCandidate,
  hit: TmdbSearchResult,
  rank: number,
  total: number,
): number {
  let s = 0;
  const a = normalize(cand.title);
  const b = normalize(hit.title);
  if (a === b) s += 0.6;
  else if (b.includes(a) || a.includes(b)) s += 0.35;
  if (cand.year && hit.release_date) {
    const hy = Number(hit.release_date.slice(0, 4));
    if (hy === cand.year) s += 0.3;
    else if (Math.abs(hy - cand.year) <= 1) s += 0.18;
    else if (Math.abs(hy - cand.year) <= 3) s += 0.05;
  }
  if (cand.type && hit.type === cand.type) s += 0.15;
  // Position bonus.
  s += Math.max(0, 0.1 * (1 - rank / Math.max(total, 1)));
  return Math.min(1, s);
}

function pickStatus(
  scored: { hit: TmdbSearchResult; score: number }[],
  cand: ImportCandidate,
): ResolveStatus {
  if (scored.length === 0) return "unmatched";
  const top = scored[0]!;
  if (top.score >= 0.7) return "matched";
  if (
    top.score >= 0.45 &&
    (cand.year ? Boolean(top.hit.release_date) : true)
  ) {
    return "matched";
  }
  if (scored.length === 1 && top.score >= 0.3) return "matched";
  return "ambiguous";
}

export async function resolveBatch(
  env: Env,
  candidates: ImportCandidate[],
): Promise<ResolvedHit[]> {
  // Limit concurrency to be polite to TMDB. 5 in flight at a time.
  const out: ResolvedHit[] = new Array(candidates.length);
  const queue = candidates.map((c, i) => ({ c, i }));
  const concurrency = 5;
  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      const { c, i } = item;
      try {
        const hits = await searchTmdb(env.TMDB_API_KEY, env.CACHE, c.title);
        const scored = hits
          .map((h, idx) => ({ hit: h, score: score(c, h, idx, hits.length) }))
          .sort((a, b) => b.score - a.score);
        const top = scored[0];
        out[i] = {
          raw: c.raw,
          status: pickStatus(scored, c),
          confidence: top?.score ?? 0,
          best: top?.hit,
          alternatives: scored.slice(1, 5).map((s) => s.hit),
        };
      } catch (err) {
        console.error("resolve item failed", c.raw, err);
        out[i] = {
          raw: c.raw,
          status: "unmatched",
          confidence: 0,
          alternatives: [],
        };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, candidates.length) }, () =>
      worker(),
    ),
  );
  return out;
}
