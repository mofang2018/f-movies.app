-- A completed check is stored even when TMDB has no credited director. This
-- prevents the director backfill from repeatedly requesting the same title.
CREATE TABLE IF NOT EXISTS media_director_checks (
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  tmdb_id INTEGER NOT NULL,
  checked_at TEXT NOT NULL,
  PRIMARY KEY (media_type, tmdb_id)
);

CREATE INDEX IF NOT EXISTS media_director_checks_checked_idx
  ON media_director_checks (checked_at);

-- Keep already enriched movie records out of the accelerated pass.
INSERT OR IGNORE INTO media_director_checks (media_type, tmdb_id, checked_at)
SELECT media_type, tmdb_id, CURRENT_TIMESTAMP
FROM media_directors
WHERE media_type = 'movie';
