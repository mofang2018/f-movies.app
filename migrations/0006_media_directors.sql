CREATE TABLE IF NOT EXISTS media_directors (
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  tmdb_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  director_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (media_type, tmdb_id, person_id)
);

CREATE INDEX IF NOT EXISTS media_directors_lookup_idx
  ON media_directors (media_type, tmdb_id, director_order);

INSERT OR IGNORE INTO sync_jobs (job_key, job_type, state, updated_at)
VALUES ('director-backfill-cursor', 'director-backfill', '0', CURRENT_TIMESTAMP);
