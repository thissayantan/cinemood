-- Migration 0005: personal access tokens
-- Supports Bearer auth for MCP and Android clients.
-- Tokens are identified by their SHA-256 hash; the plaintext is returned once
-- and never stored. Revocation ties into the existing min_issued_at watermark
-- on the users table — a logout-everywhere invalidates all tokens for that user.

CREATE TABLE IF NOT EXISTS access_tokens (
  id           TEXT NOT NULL PRIMARY KEY,           -- UUID
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,                        -- user-supplied label
  token_hash   TEXT NOT NULL UNIQUE,                 -- SHA-256 hex of raw token
  prefix       TEXT NOT NULL,                        -- first 12 chars of raw token for display
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER,
  expires_at   INTEGER                               -- NULL = never expires
);

CREATE INDEX IF NOT EXISTS idx_access_tokens_user   ON access_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_hash   ON access_tokens (token_hash);
