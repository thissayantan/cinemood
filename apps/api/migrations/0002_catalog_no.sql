-- 0002_catalog_no.sql — per-user catalog number on each watchlist entry.
-- The number turns each row into a Criterion-spine-style artifact (C-NNNN).
-- Assigned at insert time as MAX(catalog_no) + 1 for that user.

ALTER TABLE watchlist ADD COLUMN catalog_no INTEGER;

-- Backfill any existing rows in insertion order.
UPDATE watchlist
   SET catalog_no = (
     SELECT COUNT(*)
       FROM watchlist AS w2
      WHERE w2.user_id = watchlist.user_id
        AND w2.added_at <= watchlist.added_at
   )
 WHERE catalog_no IS NULL;

CREATE INDEX IF NOT EXISTS idx_watchlist_catalog
  ON watchlist(user_id, catalog_no);
