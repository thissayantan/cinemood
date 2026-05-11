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
  /** True when `best.id` (or any alternative the user could pick) is
   *  already in this user's watchlist. Server-side ground truth — the FE
   *  used to rely on a parallel `useWatchlistIds` fetch which had a race
   *  against the resolve POST and could leave the default-uncheck off
   *  entirely. */
  in_catalog?: boolean;
}

// ---------- normalization helpers ---------------------------------------

const PLACEHOLDERS = new Set([
  "unknown item",
  "unknown title",
  "untitled",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of normalize(s).split(/\s+/)) if (w) out.add(w);
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function hasLatin(s: string): boolean {
  return /[A-Za-z]/.test(s);
}

// ---------- query expansion ---------------------------------------------

interface SearchQuery {
  q: string;
  year?: number;
}

/** Expand a single candidate into 1–3 TMDB-friendly search queries.
 *
 *  Real-world watchlist exports (Google Play, IMDb, Letterboxd) tag titles
 *  with suffixes TMDB doesn't recognise:
 *    "Joe Pickett (TV)"               → suffix tag, strip it
 *    "M3GAN (Unrated)"                → suffix tag, strip it
 *    "Dahan: Raakan Ka Rahasya (Marathi)" → language tag, strip
 *    "War Dogs (2016)"                → year hint, strip + use year
 *    "แผนล่มรักวันคริสต์มาส (Christmas Is Canceled)"
 *      → non-Latin primary, English fallback in parens; try BOTH
 *
 *  We always include the original title (so well-formed titles still hit
 *  TMDB's exact-match path), but layer stripped + alternative variants so
 *  the resolver doesn't give up on the suffix-laden cases. */
export function expandQueries(cand: ImportCandidate): SearchQuery[] {
  const out: SearchQuery[] = [];
  const seenQ = new Set<string>();
  const push = (q: string, year?: number) => {
    const trimmed = q.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed) return;
    if (seenQ.has(key)) return;
    seenQ.add(key);
    out.push({ q: trimmed, year: year ?? cand.year });
  };

  push(cand.title, cand.year);

  // Year-in-parens suffix: "Title (1999)" → split off as a year hint.
  const yearMatch = cand.title.match(/^(.+?)\s*\((\d{4})\)\s*$/);
  if (yearMatch) {
    push(yearMatch[1]!, Number(yearMatch[2]));
  }

  // Generic parenthetical suffix: "Title (Marathi)", "Title (TV)", etc.
  const parenMatch = cand.title.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch && !yearMatch) {
    const main = parenMatch[1]!.trim();
    const tag = parenMatch[2]!.trim();
    push(main);
    // The parenthetical might be a transliterated / English fallback for a
    // non-Latin primary. Only fire this query when the primary lacks Latin
    // characters but the parenthetical has them — otherwise it's a tag
    // ("TV"/"Marathi") that won't help TMDB.
    if (!hasLatin(main) && hasLatin(tag)) {
      push(tag);
    }
  }

  return out;
}

// ---------- scoring -----------------------------------------------------

function score(
  cand: ImportCandidate,
  hit: TmdbSearchResult,
  rank: number,
  total: number,
): number {
  let s = 0;
  const aN = normalize(cand.title);
  const bN = normalize(hit.title);
  const aT = tokens(cand.title);
  const bT = tokens(hit.title);
  const j = jaccard(aT, bT);

  // Uncontested exact match — TMDB returned a single candidate and the
  // normalized title is identical. There is no alternative to weigh against,
  // so any ambiguity discount would be misleading. Return 1.0.
  if (total === 1 && aN && aN === bN) return 1;

  // Title similarity — caps at 0.85, the floor for a "title-only matched"
  // signal. Previously this capped at 0.6, which meant every exact-title
  // Takeout row (no year, no type) settled on 0.6 + 0.06 position = 0.66
  // and the UI showed every match at 66% — useless as a confidence signal.
  if (aN && aN === bN) s += 0.85;
  else if (j >= 0.85) s += 0.7;
  else if (j >= 0.6) s += 0.5;
  else if (j >= 0.4) s += 0.3;
  else if (aN && bN && (aN.startsWith(bN) || bN.startsWith(aN))) s += 0.3;
  else if (aN && bN && (aN.includes(bN) || bN.includes(aN))) s += 0.2;

  // Year hint confirmation — caps at 0.10 on top of the title slice.
  if (cand.year && hit.release_date) {
    const hy = Number(hit.release_date.slice(0, 4));
    if (hy === cand.year) s += 0.1;
    else if (Math.abs(hy - cand.year) <= 1) s += 0.05;
    else if (Math.abs(hy - cand.year) <= 3) s += 0.02;
  }

  // Type hint confirmation — caps at 0.05.
  if (cand.type && hit.type === cand.type) s += 0.05;

  // Position bonus — cheap tie-break only, never dominates the real signals.
  s += Math.max(0, 0.05 * (1 - rank / Math.max(total, 1)));

  return Math.min(1, s);
}

function pickStatus(
  scored: { hit: TmdbSearchResult; score: number }[],
): ResolveStatus {
  if (scored.length === 0) return "unmatched";
  const top = scored[0]!;
  // Exact-title floor (0.85 + position) → matched.
  if (top.score >= 0.85) return "matched";
  // Strong fuzzy (Jaccard ≥ 0.85, ≈0.75 with position) → matched.
  if (top.score >= 0.7) return "matched";
  // Sole candidate, reasonable similarity → matched.
  if (scored.length === 1 && top.score >= 0.55) return "matched";
  return "ambiguous";
}

// ---------- per-candidate resolution ------------------------------------

interface FoundHit {
  hit: TmdbSearchResult;
  /** Every search query string that surfaced this hit. The scorer compares
   *  the hit against each — TMDB's exact title often matches the *stripped*
   *  query ("M3GAN") instead of the original suffixed candidate
   *  ("M3GAN (Unrated)"), and the best of those scores is what we want. */
  queries: string[];
  rank: number;
  total: number;
}

async function resolveOne(
  env: Env,
  cand: ImportCandidate,
): Promise<ResolvedHit> {
  const title = cand.title.trim();
  if (!title || PLACEHOLDERS.has(title.toLowerCase())) {
    return { raw: cand.raw, status: "unmatched", confidence: 0, alternatives: [] };
  }

  const queries = expandQueries(cand);

  // Short-circuit the expansion. Every alternative query costs ~3 subrequests
  // (KV get + TMDB fetch + KV put) and a 100-item resolve chunk with three
  // queries per candidate slams the Worker's per-invocation subrequest cap
  // (~1000 paid / ~50 free) — visible in dev logs as
  //   "Too many subrequests by single Worker invocation" → silently
  //   unmatched titles. We only fall through to the next query when the
  //   prior one returned zero hits (so the scorer has *something* to score),
  //   not always.
  const seen = new Map<number, FoundHit>();
  for (const q of queries) {
    let hits: TmdbSearchResult[];
    try {
      hits = await searchTmdb(env.TMDB_API_KEY, env.CACHE, q.q);
    } catch (err) {
      console.error("import search failed", cand.raw, q.q, err);
      continue;
    }
    if (hits.length === 0) continue;
    hits.forEach((h, idx) => {
      const existing = seen.get(h.id);
      if (existing) {
        existing.queries.push(q.q);
        if (idx < existing.rank) {
          existing.rank = idx;
          existing.total = hits.length;
        }
        return;
      }
      seen.set(h.id, { hit: h, queries: [q.q], rank: idx, total: hits.length });
    });
    // The primary query is already strong enough — don't burn extra
    // searches when we have a real answer.
    if (seen.size > 0) break;
  }

  const effectiveYear =
    queries.find((q) => typeof q.year === "number")?.year ?? cand.year;

  const scored = [...seen.values()]
    .map((found) => {
      // Score the hit against the original candidate title AND against every
      // query that produced it; keep the best.
      let best = score(
        { ...cand, title: cand.title, year: effectiveYear },
        found.hit,
        found.rank,
        found.total,
      );
      for (const qt of found.queries) {
        const s = score(
          { ...cand, title: qt, year: effectiveYear },
          found.hit,
          found.rank,
          found.total,
        );
        if (s > best) best = s;
      }
      return { hit: found.hit, score: best };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  return {
    raw: cand.raw,
    status: pickStatus(scored),
    confidence: top?.score ?? 0,
    best: top?.hit,
    alternatives: scored.slice(1, 5).map((s) => s.hit),
  };
}

// ---------- batch ------------------------------------------------------

export async function resolveBatch(
  env: Env,
  candidates: ImportCandidate[],
): Promise<ResolvedHit[]> {
  // Concurrency 3 (not 5) — each in-flight resolveOne can issue up to 3
  // subrequests at once (KV get + TMDB fetch + KV put), and the Worker
  // simultaneous-outgoing-connections budget is much tighter in the dev
  // preview than the paid 1000. With concurrency 3 we keep peak in-flight
  // subreqs at ~9, which empirically clears every title in the user's
  // 223-row Takeout without "Too many subrequests" failures.
  const out: ResolvedHit[] = new Array(candidates.length);
  const queue = candidates.map((c, i) => ({ c, i }));
  const concurrency = 3;
  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      out[item.i] = await resolveOne(env, item.c);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, candidates.length) }, () =>
      worker(),
    ),
  );
  return out;
}
