/** Fire-and-forget KV write that never throws.
 *
 *  Cloudflare's free-tier KV namespace caps writes at 1000/day. Once
 *  the cap is hit, every `kv.put()` rejects with
 *    Error: KV put() limit exceeded for the day.
 *  If a caller awaits that promise (we do — to keep cache writes
 *  predictable), the surrounding TMDB-fetch / OMDB-fetch path rejects,
 *  the commit marks the row `fetch_failed`, and the user sees every
 *  import row turn red despite the upstream call having succeeded.
 *
 *  KV is just a cache. We already have the upstream data in hand by the
 *  time we call `put`. Failing to *cache* it is not a failure that
 *  should escape to user code — at worst we re-fetch next time.
 *
 *  Log + swallow. */
export async function kvPutSafe(
  kv: KVNamespace,
  key: string,
  value: string,
  options?: KVNamespacePutOptions,
): Promise<void> {
  try {
    await kv.put(key, value, options);
  } catch (err) {
    // Don't spam the log with the same daily-cap message on every miss —
    // one short line is enough.
    const msg =
      err instanceof Error ? err.message : String(err);
    console.warn("kv put failed (non-fatal)", key, msg);
  }
}
