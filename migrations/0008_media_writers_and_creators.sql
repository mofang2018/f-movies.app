CREATE TABLE IF NOT EXISTS media_writers (
  media_type TEXT NOT NULL CHECK (media_type = 'movie'),
  tmdb_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  credit_role TEXT NOT NULL,
  writer_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (media_type, tmdb_id, person_id, credit_role)
);

CREATE INDEX IF NOT EXISTS media_writers_lookup_idx
  ON media_writers (media_type, tmdb_id, writer_order);

CREATE TABLE IF NOT EXISTS media_creators (
  media_type TEXT NOT NULL CHECK (media_type = 'tv'),
  tmdb_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  creator_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (media_type, tmdb_id, person_id)
);

CREATE INDEX IF NOT EXISTS media_creators_lookup_idx
  ON media_creators (media_type, tmdb_id, creator_order);

-- A check is retained even when TMDB has no matching credit. This makes both
-- enrichment passes finite and prevents repeated requests for an absence.
CREATE TABLE IF NOT EXISTS media_movie_crew_checks (
  tmdb_id INTEGER PRIMARY KEY,
  checked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_creator_checks (
  tmdb_id INTEGER PRIMARY KEY,
  checked_at TEXT NOT NULL
);

INSERT OR IGNORE INTO sync_jobs (job_key, job_type, state, updated_at)
VALUES ('movie-crew-backfill', 'movie-crew-backfill', 'running', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO sync_jobs (job_key, job_type, state, updated_at)
VALUES ('creator-backfill', 'creator-backfill', 'running', CURRENT_TIMESTAMP);

-- Replaced by movie-crew-backfill, which includes Writer/Screenplay credits.
UPDATE sync_jobs SET state = 'done', updated_at = CURRENT_TIMESTAMP
WHERE job_key = 'director-backfill-cursor';
