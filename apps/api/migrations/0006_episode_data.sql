-- Migration 0006: Add series episode/season metadata columns to titles
-- These columns carry no CHECK constraints, so plain ALTER TABLE is safe.
-- COALESCE in the UPSERT ensures an existing value is never overwritten by NULL.

ALTER TABLE titles ADD COLUMN number_of_seasons    INTEGER;
ALTER TABLE titles ADD COLUMN number_of_episodes   INTEGER;
ALTER TABLE titles ADD COLUMN seasons              TEXT;   -- JSON array of season summaries
ALTER TABLE titles ADD COLUMN next_episode_to_air  TEXT;   -- JSON object (null for movies)
ALTER TABLE titles ADD COLUMN last_episode_to_air  TEXT;   -- JSON object (null for movies)
