CREATE TABLE IF NOT EXISTS media_countries (
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  tmdb_id INTEGER NOT NULL,
  country_code TEXT NOT NULL,
  PRIMARY KEY (media_type, tmdb_id, country_code)
);

CREATE INDEX IF NOT EXISTS media_countries_lookup_idx
  ON media_countries (country_code, media_type, tmdb_id);
