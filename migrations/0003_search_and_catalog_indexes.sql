CREATE VIRTUAL TABLE IF NOT EXISTS media_search USING fts5(
  title,
  original_title,
  content='media',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

INSERT INTO media_search (rowid, title, original_title)
SELECT rowid, title, COALESCE(original_title, '') FROM media
WHERE NOT EXISTS (SELECT 1 FROM media_search LIMIT 1);

CREATE TRIGGER IF NOT EXISTS media_search_after_insert AFTER INSERT ON media BEGIN
  INSERT INTO media_search (rowid, title, original_title)
  VALUES (new.rowid, new.title, COALESCE(new.original_title, ''));
END;

CREATE TRIGGER IF NOT EXISTS media_search_after_delete AFTER DELETE ON media BEGIN
  INSERT INTO media_search (media_search, rowid, title, original_title)
  VALUES ('delete', old.rowid, old.title, COALESCE(old.original_title, ''));
END;

CREATE TRIGGER IF NOT EXISTS media_search_after_update AFTER UPDATE OF title, original_title ON media BEGIN
  INSERT INTO media_search (media_search, rowid, title, original_title)
  VALUES ('delete', old.rowid, old.title, COALESCE(old.original_title, ''));
  INSERT INTO media_search (rowid, title, original_title)
  VALUES (new.rowid, new.title, COALESCE(new.original_title, ''));
END;

-- The per-type popularity index in 0001 covers movie/TV lists. Home also
-- mixes both types, so this avoids a full catalog sort as the cache grows.
CREATE INDEX IF NOT EXISTS media_global_popularity_idx
  ON media (popularity DESC);

CREATE INDEX IF NOT EXISTS media_cast_order_idx
  ON media_cast (media_type, tmdb_id, cast_order);
