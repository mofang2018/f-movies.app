CREATE TABLE IF NOT EXISTS media (
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  tmdb_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  original_title TEXT,
  overview TEXT NOT NULL DEFAULT '',
  release_date TEXT NOT NULL DEFAULT '',
  vote_average REAL NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0,
  popularity REAL NOT NULL DEFAULT 0,
  poster_path TEXT,
  backdrop_path TEXT,
  runtime INTEGER,
  seasons INTEGER,
  status TEXT,
  updated_at TEXT NOT NULL,
  tmdb_updated_at TEXT,
  PRIMARY KEY (media_type, tmdb_id)
);

CREATE INDEX IF NOT EXISTS media_popularity_idx ON media (media_type, popularity DESC);
CREATE INDEX IF NOT EXISTS media_rating_idx ON media (media_type, vote_average DESC, vote_count DESC);
CREATE INDEX IF NOT EXISTS media_release_idx ON media (media_type, release_date DESC);
CREATE INDEX IF NOT EXISTS media_title_idx ON media (title);

CREATE TABLE IF NOT EXISTS genres (
  genre_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'movie',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_genres (
  media_type TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  genre_id INTEGER NOT NULL,
  PRIMARY KEY (media_type, tmdb_id, genre_id)
);

CREATE INDEX IF NOT EXISTS media_genres_lookup_idx ON media_genres (genre_id, media_type, tmdb_id);

CREATE TABLE IF NOT EXISTS media_cast (
  media_type TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  character_name TEXT NOT NULL DEFAULT '',
  profile_path TEXT,
  cast_order INTEGER NOT NULL,
  PRIMARY KEY (media_type, tmdb_id, person_id)
);

CREATE TABLE IF NOT EXISTS sync_jobs (
  job_key TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  seeded_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error TEXT
);
