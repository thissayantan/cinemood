-- 0004_watching_status.sql — add a third status value: 'watching'.
--
-- SQLite's CHECK constraints are baked into the table definition and
-- cannot be changed with ALTER TABLE. The standard workaround (the SQLite
-- 12-step table-rebuild) is used here: create the new table, copy rows,
-- drop the old table, and rename the new one. Foreign keys are disabled
-- for the duration of the reconstruction.
--
-- New column: `started_at INTEGER` — unix timestamp set automatically
-- when a row transitions to 'watching'.
PRAGMA foreign_keys = OFF;

CREATE TABLE watchlist_new (
  user_id     TEXT    NOT NULL,
  title_id    INTEGER NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'watching', 'watched')),
  added_at    INTEGER NOT NULL,
  started_at  INTEGER,          -- set when status enters 'watching'
  watched_at  INTEGER,          -- set when status enters 'watched'
  notes       TEXT,
  catalog_no  INTEGER,
  PRIMARY KEY (user_id, title_id),
  FOREIGN KEY (user_id)   REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (title_id)  REFERENCES titles(id)
);

INSERT INTO watchlist_new (user_id, title_id, status, added_at, watched_at, notes, catalog_no)
  SELECT user_id, title_id, status, added_at, watched_at, notes, catalog_no
    FROM watchlist;

DROP TABLE watchlist;
ALTER TABLE watchlist_new RENAME TO watchlist;

CREATE INDEX idx_watchlist_user    ON watchlist(user_id, status);
CREATE INDEX idx_watchlist_catalog ON watchlist(user_id, catalog_no);

PRAGMA foreign_keys = ON;
