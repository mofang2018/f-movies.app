CREATE TABLE IF NOT EXISTS media_trailers (
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  tmdb_id INTEGER NOT NULL,
  youtube_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (media_type, tmdb_id)
);

INSERT OR IGNORE INTO sync_jobs (job_key, job_type, state, updated_at)
VALUES ('trailer-backfill-cursor', 'trailer-backfill', '0', CURRENT_TIMESTAMP);
