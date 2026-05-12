# Security

If you find a vulnerability, please **don't open a public issue**. Email the maintainer at `sayantan [at] sayantan.cloud` with a short description and reproduction steps; reports are responded to within a week, typically much sooner.

Especially welcome: anything affecting OAuth state handling, the stateless signed-cookie session codec (`apps/api/src/lib/session.ts`), the AES-GCM-encrypted per-user LLM key storage (`apps/api/src/lib/crypto.ts`), or D1 query parameterisation. Secrets are uploaded via `wrangler secret put` and are never committed; if you spot one in the repo or in commit history, treat it as urgent.
