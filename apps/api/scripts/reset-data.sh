#!/usr/bin/env bash
# Destructive — wipes every watchlist row, every cached TMDB title, every
# Orama R2 index snapshot, and the TMDB/OMDB KV cache. Keeps:
#   - users           (so you don't have to re-OAuth)
#   - app_settings    (the global defaults singleton)
#   - SESSIONS KV     (active sessions + per-user encrypted llm_config)
#
# Usage:
#   bun run reset:data                 # remote (production data)
#   bun run reset:data -- --local      # local .wrangler/state only
#
# Always asks "type RESET to confirm" unless --yes is passed.

set -euo pipefail

cd "$(dirname "$0")/.."

MODE_FLAG="--remote"
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --local)  MODE_FLAG="--local" ;;
    --remote) MODE_FLAG="--remote" ;;
    --yes|-y) ASSUME_YES=1 ;;
    *) echo "unknown arg: $arg"; exit 2 ;;
  esac
done

cat <<HEAD
==============================================================================
  Cinemood data reset — ${MODE_FLAG#--} D1 + R2 + KV CACHE
==============================================================================
This will:
  - DELETE every row from watchlist + titles  (D1, $MODE_FLAG)
  - DELETE every object from the R2 INDEX_BUCKET
  - DELETE every tmdb:* / omdb:* / search:* key from KV CACHE
Keeps: users, app_settings, SESSIONS (session + llm_config).
HEAD

if [ "$ASSUME_YES" -ne 1 ]; then
  printf "\nType  RESET  to confirm: "
  read -r answer
  if [ "$answer" != "RESET" ]; then
    echo "aborted"
    exit 1
  fi
fi

echo
echo "→ D1 truncate"
bunx wrangler d1 execute cinemood $MODE_FLAG \
  --command "DELETE FROM watchlist; DELETE FROM titles;" 2>&1 | tail -10

echo
echo "→ R2 wipe per-user Orama snapshots"
# wrangler doesn't expose `r2 object list`, so we enumerate user ids from
# D1 (the truncate above ran AFTER the users were captured, but users
# itself isn't touched — `users` survives the reset). For each user id we
# delete the `index/{userId}.json` snapshot if any. Pre-deletion list is
# taken BEFORE the D1 truncate runs for the case when this script is
# invoked alone.
USER_IDS=$(bunx wrangler d1 execute cinemood $MODE_FLAG \
  --command "SELECT id FROM users" --json 2>/dev/null \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
for row in data[0].get('results', []):
    print(row['id'])
" || true)
# Also include known test ids so smoke artefacts don't linger.
USER_IDS="${USER_IDS}
u_smoke"
DELETED=0
while IFS= read -r uid; do
  [ -z "$uid" ] && continue
  if bunx wrangler r2 object delete "cinemood-index/index/${uid}.json" $MODE_FLAG 2>&1 \
     | grep -q "Delete complete"; then
    DELETED=$((DELETED+1))
    echo "  - removed index/${uid}.json"
  fi
done <<< "$USER_IDS"
if [ "$DELETED" -eq 0 ]; then
  echo "  (no snapshots to remove)"
fi

echo
echo "→ KV CACHE wipe tmdb:* / omdb:* / search:*"
# kv bulk delete takes a JSON array of keys.
TMP=$(mktemp)
trap "rm -f $TMP" EXIT
bunx wrangler kv key list --binding=CACHE $MODE_FLAG --prefix= 2>/dev/null \
  | python3 -c "
import json, sys
keys = json.load(sys.stdin)
out = [k['name'] for k in keys
       if any(k['name'].startswith(p) for p in ('tmdb:', 'omdb:', 'search:'))]
print(json.dumps(out))
" > "$TMP"

COUNT=$(python3 -c "import json; print(len(json.load(open('$TMP'))))")
if [ "$COUNT" -eq 0 ]; then
  echo "  (no matching keys)"
else
  echo "  deleting $COUNT keys"
  bunx wrangler kv bulk delete --binding=CACHE $MODE_FLAG "$TMP" --force 2>&1 | tail -3
fi

echo
echo "✓ reset complete"
