-- Initial discovery runs frequently until the configured TMDB page range has
-- been scanned once. Afterwards the scheduler switches to a daily refresh.
INSERT OR IGNORE INTO sync_jobs (job_key, job_type, state, updated_at)
VALUES ('catalog-initial-import', 'catalog-initial-import', 'running', CURRENT_TIMESTAMP);
