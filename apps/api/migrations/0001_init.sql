-- 0001_init.sql — initial schema for cinemood

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS titles (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('movie','series')),
  title TEXT NOT NULL,
  original_title TEXT,
  overview TEXT,
  release_date TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  vote_average REAL,
  vote_count INTEGER,
  runtime INTEGER,
  genres TEXT,
  cast_json TEXT,
  keywords TEXT,
  providers TEXT,
  imdb_id TEXT,
  imdb_rating REAL,
  raw_tmdb TEXT,
  fetched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist (
  user_id TEXT NOT NULL,
  title_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','watched')),
  added_at INTEGER NOT NULL,
  watched_at INTEGER,
  notes TEXT,
  PRIMARY KEY (user_id, title_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (title_id) REFERENCES titles(id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id, status);
CREATE INDEX IF NOT EXISTS idx_titles_release ON titles(release_date);

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  default_llm_provider TEXT NOT NULL DEFAULT 'cloudflare',
  default_llm_model TEXT NOT NULL DEFAULT '@cf/openai/gpt-oss-20b',
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO app_settings (id, updated_at)
VALUES (1, strftime('%s','now'));
