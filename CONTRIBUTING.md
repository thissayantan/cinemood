# Contributing

Cinemood is a small personal project; the main reason for the public repo is so others can fork the architecture (single-Worker SPA + API + edge search) and read the code. PRs are welcome but please open an issue first so we can talk about scope — many "obvious" feature ideas conflict with the deliberately-narrow product (one personal watchlist, no sharing, no mobile app).

Before submitting a PR: run `bun run typecheck && bun run build` from the repo root and make sure both pass. Follow the commit-message convention in [`CLAUDE.md`](CLAUDE.md) (gitmoji + `<type>(<scope>): subject`). Keep changes atomic — one logical change per commit. If you touch a file that has a "Learned Rule" pinning a behaviour (see the bottom of `CLAUDE.md`), preserve that behaviour or write a follow-up rule explaining why it's now different.
