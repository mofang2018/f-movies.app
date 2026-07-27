export interface SyncEnv {
  CATALOG_DB: D1Database;
  TMDB_IMAGES: R2Bucket;
  MEDIA_SYNC_QUEUE: Queue<SyncMessage>;
  // Kept while previously queued image messages drain; new images are persisted
  // directly by the media consumer to stay within the Queues free-tier quota.
  IMAGE_INGEST_QUEUE: Queue<ImageMessage>;
  TMDB_RATE_LIMITER: DurableObjectNamespace;
  TMDB_READ_ACCESS_TOKEN: string;
  SYNC_ADMIN_TOKEN?: string;
}

type MediaType = "movie" | "tv";

interface MediaMessage {
  kind: "media";
  mediaType: MediaType;
  tmdbId: number;
}

interface ImageMessage {
  kind: "image";
  imageType: "poster" | "backdrop" | "profile";
  path: string;
}

type SyncMessage = MediaMessage | ImageMessage;

interface TmdbListResponse {
  results: Array<{ id: number; media_type?: string }>;
}

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbCountry {
  iso_3166_1?: string;
}

interface TmdbVideo {
  site?: string;
  key?: string;
  type?: string;
  official?: boolean;
}

interface TmdbDetail {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  poster_path?: string | null;
  backdrop_path?: string | null;
  runtime?: number | null;
  number_of_seasons?: number | null;
  status?: string;
  genres?: TmdbGenre[];
  production_countries?: TmdbCountry[];
  origin_country?: string[];
  videos?: { results?: TmdbVideo[] };
  credits?: {
    cast?: Array<{
      id: number;
      name: string;
      character?: string;
      profile_path?: string | null;
      order?: number;
    }>;
    crew?: Array<{
      id: number;
      name: string;
      job?: string;
    }>;
  };
}

const apiBase = "https://api.themoviedb.org/3";
const maxImageBytes = { poster: 8_000_000, profile: 8_000_000, backdrop: 16_000_000 } as const;

function now(): string {
  return new Date().toISOString();
}

function isValidImagePath(path: string): boolean {
  return /^\/[a-zA-Z0-9_-]+\.(?:avif|jpe?g|png|webp)$/.test(path);
}

const cachedImageSizes = { poster: "w342", backdrop: "w1280", profile: "w185" } as const;

function imageKey(message: ImageMessage): string {
  return `tmdb/${message.imageType}/${cachedImageSizes[message.imageType]}/${message.path.slice(1)}`;
}

function retryDelay(attempt: number, retryAfter?: string | null): number {
  const retrySeconds = Number(retryAfter);
  if (Number.isFinite(retrySeconds) && retrySeconds > 0) return Math.min(900, Math.ceil(retrySeconds));
  return Math.min(900, 60 * (2 ** Math.min(attempt, 4)) + Math.floor(Math.random() * 10));
}

async function takeRateLimitToken(env: SyncEnv): Promise<void> {
  const limiter = env.TMDB_RATE_LIMITER.get(env.TMDB_RATE_LIMITER.idFromName("tmdb-api-global"));
  const response = await limiter.fetch("https://rate-limiter.internal/take");
  if (!response.ok) throw new Error("TMDB rate limiter unavailable");
  const { waitMs } = await response.json<{ waitMs: number }>();
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

async function tmdbFetch<T>(env: SyncEnv, path: string, params: Record<string, string | number> = {}): Promise<T> {
  if (!env.TMDB_READ_ACCESS_TOKEN) throw new Error("TMDB_READ_ACCESS_TOKEN is not configured");
  await takeRateLimitToken(env);
  const url = new URL(`${apiBase}${path}`);
  url.searchParams.set("language", "en-US");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const error = new Error(`TMDB ${response.status} ${path}`) as Error & { status?: number; retryAfter?: string | null };
    error.status = response.status;
    error.retryAfter = response.headers.get("Retry-After");
    throw error;
  }
  return response.json() as Promise<T>;
}

async function enqueueSeeds(env: SyncEnv, limit: number, pageOverride?: number): Promise<number> {
  const cursor = await env.CATALOG_DB.prepare("SELECT state FROM sync_jobs WHERE job_key = ?")
    .bind("seed-page-cursor").first<{ state: string }>();
  const page = pageOverride ?? Math.max(1, Math.min(500, Number(cursor?.state ?? 1) || 1));
  const sources: Array<{ path: string; mediaType: MediaType }> = [
    { path: "/trending/all/day", mediaType: "movie" },
    { path: "/trending/all/week", mediaType: "movie" },
    { path: "/movie/popular", mediaType: "movie" },
    { path: "/movie/now_playing", mediaType: "movie" },
    { path: "/movie/top_rated", mediaType: "movie" },
    { path: "/tv/popular", mediaType: "tv" },
    { path: "/tv/on_the_air", mediaType: "tv" },
    { path: "/tv/top_rated", mediaType: "tv" },
  ];
  const lists = await Promise.all(sources.map(async (source) => ({
    source,
    list: await tmdbFetch<TmdbListResponse>(env, source.path, { page }),
  })));
  const seen = new Set<string>();
  const messages: MediaMessage[] = [];
  for (const { source, list } of lists) {
    for (const item of list.results) {
      const mediaType: MediaType = item.media_type === "tv" ? "tv" : item.media_type === "movie" ? "movie" : source.mediaType;
      const key = `${mediaType}:${item.id}`;
      if (seen.has(key) || messages.length >= limit) continue;
      seen.add(key);
      messages.push({ kind: "media", mediaType, tmdbId: item.id });
    }
  }
  for (let index = 0; index < messages.length; index += 100) {
    await env.MEDIA_SYNC_QUEUE.sendBatch(messages.slice(index, index + 100).map((body) => ({ body })));
  }
  if (pageOverride === undefined) {
    const nextPage = page >= 500 ? 1 : page + 1;
    await env.CATALOG_DB.prepare(`INSERT INTO sync_jobs (job_key, job_type, state, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(job_key) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at`)
      .bind("seed-page-cursor", "catalog-page", String(nextPage), now()).run();
  }
  if (pageOverride === undefined && page >= 500) {
    await env.CATALOG_DB.prepare("UPDATE sync_jobs SET state = ?, updated_at = ? WHERE job_key = ?")
      .bind("done", now(), "catalog-initial-import").run();
  }
  return messages.length;
}

async function isInitialImportRunning(env: SyncEnv): Promise<boolean> {
  const job = await env.CATALOG_DB.prepare("SELECT state FROM sync_jobs WHERE job_key = ?")
    .bind("catalog-initial-import").first<{ state: string }>();
  return !job || job.state !== "done";
}

/**
 * One-time/backfillable enrichment for records that predate media_countries.
 * The job is opt-in through sync_jobs so normal cron runs stay inexpensive.
 */
async function runCountryBackfill(env: SyncEnv, limit = 50): Promise<number> {
  const job = await env.CATALOG_DB.prepare("SELECT state FROM sync_jobs WHERE job_key = ?")
    .bind("country-backfill-cursor").first<{ state: string }>();
  if (!job || job.state === "done") return 0;

  const cursor = Math.max(0, Number(job.state) || 0);
  const rows = await env.CATALOG_DB.prepare(`SELECT rowid, media_type, tmdb_id FROM media
    WHERE rowid > ? ORDER BY rowid LIMIT ?`).bind(cursor, limit).all<{ rowid: number; media_type: MediaType; tmdb_id: number }>();
  // Country enrichment is a one-off, sequential job. It bypasses Queues and
  // reads only the country fields needed for the D1 index.
  for (const row of rows.results) {
    await processCountries(env, row.media_type, row.tmdb_id);
  }
  const nextState = rows.results.length < limit ? "done" : String(rows.results.at(-1)?.rowid ?? cursor);
  await env.CATALOG_DB.prepare("UPDATE sync_jobs SET state = ?, updated_at = ? WHERE job_key = ?")
    .bind(nextState, now(), "country-backfill-cursor").run();
  return rows.results.length;
}

function trailerKeyFor(detail: TmdbDetail): string | null {
  const videos = (detail.videos?.results ?? []).filter((video) => video.site === "YouTube" && /^[A-Za-z0-9_-]{11}$/.test(video.key ?? ""));
  const preferred = videos.find((video) => video.type === "Trailer" && video.official)
    ?? videos.find((video) => video.type === "Trailer")
    ?? videos.find((video) => video.type === "Teaser" && video.official)
    ?? videos.find((video) => video.type === "Teaser");
  return preferred?.key ?? null;
}

function isTmdbNotFound(error: unknown): boolean {
  return (error as { status?: number }).status === 404;
}

/** One-time trailer enrichment for the catalogue that existed before trailers. */
async function runTrailerBackfill(env: SyncEnv, limit = 50): Promise<number> {
  const job = await env.CATALOG_DB.prepare("SELECT state FROM sync_jobs WHERE job_key = ?")
    .bind("trailer-backfill-cursor").first<{ state: string }>();
  if (!job || job.state === "done") return 0;

  const cursor = Math.max(0, Number(job.state) || 0);
  const rows = await env.CATALOG_DB.prepare(`SELECT rowid, media_type, tmdb_id FROM media
    WHERE rowid > ? ORDER BY rowid LIMIT ?`).bind(cursor, limit).all<{ rowid: number; media_type: MediaType; tmdb_id: number }>();
  let completed = 0;
  let lastRowId = cursor;
  for (const row of rows.results) {
    try {
      const detail = await tmdbFetch<TmdbDetail>(env, `/${row.media_type}/${row.tmdb_id}`, { append_to_response: "videos" });
      const trailerKey = trailerKeyFor(detail);
      // This is a one-time forward-only job. Missing trailers do not need a
      // tombstone, so skip a write for them and keep D1 usage low.
      if (trailerKey) {
        await env.CATALOG_DB.prepare(`INSERT INTO media_trailers (media_type, tmdb_id, youtube_key, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(media_type, tmdb_id) DO UPDATE SET youtube_key=excluded.youtube_key, updated_at=excluded.updated_at`)
          .bind(row.media_type, row.tmdb_id, trailerKey, now()).run();
      }
    } catch (error) {
      if (!isTmdbNotFound(error)) throw error;
    }
    completed += 1;
    lastRowId = row.rowid;
    // Save a small checkpoint so a transient API or D1 error only repeats a
    // few records on the next scheduled run.
    if (completed % 10 === 0 || completed === rows.results.length) {
      const state = completed === rows.results.length && rows.results.length < limit ? "done" : String(lastRowId);
      await env.CATALOG_DB.prepare("UPDATE sync_jobs SET state = ?, updated_at = ? WHERE job_key = ?")
        .bind(state, now(), "trailer-backfill-cursor").run();
    }
  }
  return rows.results.length;
}

function countryCodesFor(detail: TmdbDetail): string[] {
  return [...new Set([
    ...(detail.production_countries ?? []).map((country) => country.iso_3166_1),
    ...(detail.origin_country ?? []),
  ].filter((code): code is string => /^[A-Z]{2}$/.test(code ?? "")))];
}

function directorsFor(detail: TmdbDetail): Array<{ id: number; name: string }> {
  const seen = new Set<number>();
  return (detail.credits?.crew ?? []).flatMap((person) => {
    if (person.job !== "Director" || seen.has(person.id)) return [];
    seen.add(person.id);
    return [{ id: person.id, name: person.name }];
  });
}

/**
 * One-time movie-director enrichment. TV series are intentionally excluded:
 * they usually have creators/showrunners rather than one reliable director.
 * Every examined movie receives a check record, including titles for which
 * TMDB has no director credit, so this job is finite and never re-fetches a
 * verified absence.
 */
async function runDirectorBackfill(env: SyncEnv, limit = 500): Promise<number> {
  const job = await env.CATALOG_DB.prepare("SELECT state FROM sync_jobs WHERE job_key = ?")
    .bind("director-backfill-cursor").first<{ state: string }>();
  if (!job || job.state === "done") return 0;

  const rows = await env.CATALOG_DB.prepare(`SELECT m.media_type, m.tmdb_id FROM media m
    LEFT JOIN media_director_checks checked
      ON checked.media_type = m.media_type AND checked.tmdb_id = m.tmdb_id
    WHERE m.media_type = 'movie' AND checked.tmdb_id IS NULL
    ORDER BY m.popularity DESC, m.tmdb_id DESC
    LIMIT ?`).bind(limit).all<{ media_type: MediaType; tmdb_id: number }>();
  for (const row of rows.results) {
    try {
      const detail = await tmdbFetch<TmdbDetail>(env, `/${row.media_type}/${row.tmdb_id}`, { append_to_response: "credits" });
      const statements: D1PreparedStatement[] = [
        env.CATALOG_DB.prepare("DELETE FROM media_directors WHERE media_type = ? AND tmdb_id = ?").bind(row.media_type, row.tmdb_id),
      ];
      for (const [index, director] of directorsFor(detail).entries()) {
        statements.push(env.CATALOG_DB.prepare(`INSERT INTO media_directors (media_type, tmdb_id, person_id, name, director_order)
          VALUES (?, ?, ?, ?, ?)`).bind(row.media_type, row.tmdb_id, director.id, director.name, index));
      }
      statements.push(env.CATALOG_DB.prepare(`INSERT INTO media_director_checks (media_type, tmdb_id, checked_at)
        VALUES (?, ?, ?)
        ON CONFLICT(media_type, tmdb_id) DO UPDATE SET checked_at=excluded.checked_at`)
        .bind(row.media_type, row.tmdb_id, now()));
      await env.CATALOG_DB.batch(statements);
    } catch (error) {
      if (!isTmdbNotFound(error)) throw error;
      await env.CATALOG_DB.prepare(`INSERT INTO media_director_checks (media_type, tmdb_id, checked_at)
        VALUES (?, ?, ?)
        ON CONFLICT(media_type, tmdb_id) DO UPDATE SET checked_at=excluded.checked_at`)
        .bind(row.media_type, row.tmdb_id, now()).run();
    }
  }
  const nextState = rows.results.length < limit ? "done" : "running";
  await env.CATALOG_DB.prepare("UPDATE sync_jobs SET state = ?, updated_at = ? WHERE job_key = ?")
    .bind(nextState, now(), "director-backfill-cursor").run();
  return rows.results.length;
}

async function processCountries(env: SyncEnv, mediaType: MediaType, tmdbId: number): Promise<void> {
  let detail: TmdbDetail;
  try {
    detail = await tmdbFetch<TmdbDetail>(env, `/${mediaType}/${tmdbId}`);
  } catch (error) {
    if (isTmdbNotFound(error)) return;
    throw error;
  }
  const statements: D1PreparedStatement[] = [
    env.CATALOG_DB.prepare("DELETE FROM media_countries WHERE media_type = ? AND tmdb_id = ?").bind(mediaType, tmdbId),
  ];
  for (const countryCode of countryCodesFor(detail)) {
    statements.push(env.CATALOG_DB.prepare(
      "INSERT INTO media_countries (media_type, tmdb_id, country_code) VALUES (?, ?, ?)",
    ).bind(mediaType, tmdbId, countryCode));
  }
  await env.CATALOG_DB.batch(statements);
}

async function storeDetail(env: SyncEnv, mediaType: MediaType, detail: TmdbDetail): Promise<void> {
  const updatedAt = now();
  const genres = detail.genres ?? [];
  const countryCodes = countryCodesFor(detail);
  const trailerKey = trailerKeyFor(detail);
  const cast = (detail.credits?.cast ?? []).slice(0, 10);
  const directors = directorsFor(detail);
  const statements: D1PreparedStatement[] = [
    env.CATALOG_DB.prepare(`INSERT INTO media (
      media_type, tmdb_id, title, original_title, overview, release_date, vote_average, vote_count,
      popularity, poster_path, backdrop_path, runtime, seasons, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(media_type, tmdb_id) DO UPDATE SET
      title=excluded.title, original_title=excluded.original_title, overview=excluded.overview,
      release_date=excluded.release_date, vote_average=excluded.vote_average, vote_count=excluded.vote_count,
      popularity=excluded.popularity, poster_path=excluded.poster_path, backdrop_path=excluded.backdrop_path,
      runtime=excluded.runtime, seasons=excluded.seasons, status=excluded.status, updated_at=excluded.updated_at`)
      .bind(
        mediaType, detail.id, detail.title ?? detail.name ?? "Untitled", detail.original_title ?? detail.original_name ?? null,
        detail.overview ?? "", detail.release_date ?? detail.first_air_date ?? "", detail.vote_average ?? 0,
        detail.vote_count ?? 0, detail.popularity ?? 0, detail.poster_path ?? null, detail.backdrop_path ?? null,
        detail.runtime ?? null, detail.number_of_seasons ?? null, detail.status ?? null, updatedAt,
      ),
    env.CATALOG_DB.prepare("DELETE FROM media_genres WHERE media_type = ? AND tmdb_id = ?").bind(mediaType, detail.id),
    env.CATALOG_DB.prepare("DELETE FROM media_cast WHERE media_type = ? AND tmdb_id = ?").bind(mediaType, detail.id),
    env.CATALOG_DB.prepare("DELETE FROM media_directors WHERE media_type = ? AND tmdb_id = ?").bind(mediaType, detail.id),
    env.CATALOG_DB.prepare("DELETE FROM media_countries WHERE media_type = ? AND tmdb_id = ?").bind(mediaType, detail.id),
    env.CATALOG_DB.prepare("DELETE FROM media_trailers WHERE media_type = ? AND tmdb_id = ?").bind(mediaType, detail.id),
  ];
  for (const genre of genres) {
    statements.push(
      env.CATALOG_DB.prepare("INSERT INTO genres (genre_id, name, updated_at) VALUES (?, ?, ?) ON CONFLICT(genre_id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at")
        .bind(genre.id, genre.name, updatedAt),
      env.CATALOG_DB.prepare("INSERT INTO media_genres (media_type, tmdb_id, genre_id) VALUES (?, ?, ?)")
        .bind(mediaType, detail.id, genre.id),
    );
  }
  for (const countryCode of countryCodes) {
    statements.push(env.CATALOG_DB.prepare(
      "INSERT INTO media_countries (media_type, tmdb_id, country_code) VALUES (?, ?, ?)",
    ).bind(mediaType, detail.id, countryCode));
  }
  if (trailerKey) {
    statements.push(env.CATALOG_DB.prepare(
      "INSERT INTO media_trailers (media_type, tmdb_id, youtube_key, updated_at) VALUES (?, ?, ?, ?)",
    ).bind(mediaType, detail.id, trailerKey, updatedAt));
  }
  for (const person of cast) {
    statements.push(env.CATALOG_DB.prepare(
      "INSERT INTO media_cast (media_type, tmdb_id, person_id, name, character_name, profile_path, cast_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(mediaType, detail.id, person.id, person.name, person.character ?? "", person.profile_path ?? null, person.order ?? 0));
  }
  for (const [index, director] of directors.entries()) {
    statements.push(env.CATALOG_DB.prepare(
      "INSERT INTO media_directors (media_type, tmdb_id, person_id, name, director_order) VALUES (?, ?, ?, ?, ?)",
    ).bind(mediaType, detail.id, director.id, director.name, index));
  }
  if (mediaType === "movie") {
    statements.push(env.CATALOG_DB.prepare(`INSERT INTO media_director_checks (media_type, tmdb_id, checked_at)
      VALUES (?, ?, ?)
      ON CONFLICT(media_type, tmdb_id) DO UPDATE SET checked_at=excluded.checked_at`)
      .bind(mediaType, detail.id, updatedAt));
  }
  await env.CATALOG_DB.batch(statements);

  // Do not enqueue every poster and backdrop as a separate Queue message.
  // At catalog scale that quickly exhausts the Queues free-tier daily write quota.
  // Two bounded image writes within the existing media message retain R2 caching
  // while keeping the queue budget dedicated to catalog metadata.
  const images: ImageMessage[] = [];
  if (detail.poster_path && isValidImagePath(detail.poster_path)) images.push({ kind: "image", imageType: "poster", path: detail.poster_path });
  if (detail.backdrop_path && isValidImagePath(detail.backdrop_path)) images.push({ kind: "image", imageType: "backdrop", path: detail.backdrop_path });
  await Promise.all(images.map((image) => processImage(env, image)));
}

async function processMedia(env: SyncEnv, message: MediaMessage): Promise<void> {
  const detail = await tmdbFetch<TmdbDetail>(env, `/${message.mediaType}/${message.tmdbId}`, {
    append_to_response: "credits,videos",
  });
  await storeDetail(env, message.mediaType, detail);
}

async function processImage(env: SyncEnv, message: ImageMessage): Promise<void> {
  if (!isValidImagePath(message.path)) throw new Error("Invalid TMDB image path");
  const key = imageKey(message);
  if (await env.TMDB_IMAGES.head(key)) return;
  const response = await fetch(`https://image.tmdb.org/t/p/${cachedImageSizes[message.imageType]}${message.path}`, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    const error = new Error(`TMDB image ${response.status}`) as Error & { status?: number; retryAfter?: string | null };
    error.status = response.status;
    error.retryAfter = response.headers.get("Retry-After");
    throw error;
  }
  const contentType = response.headers.get("Content-Type") ?? "";
  const expectedMaximum = maxImageBytes[message.imageType];
  const contentLength = Number(response.headers.get("Content-Length") ?? 0);
  if (!contentType.startsWith("image/") || (contentLength && contentLength > expectedMaximum)) throw new Error("Rejected TMDB image response");
  const body = await response.arrayBuffer();
  if (body.byteLength > expectedMaximum) throw new Error("TMDB image exceeds size limit");
  await env.TMDB_IMAGES.put(key, body, {
    httpMetadata: { contentType, cacheControl: "public, max-age=2592000" },
    customMetadata: { source: "tmdb", sourcePath: message.path, cachedAt: now() },
  });
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  return !status || status === 429 || status >= 500;
}

function errorDelay(error: unknown, attempt: number): number {
  return retryDelay(attempt, (error as { retryAfter?: string | null }).retryAfter);
}

export class TmdbRateLimiter implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname !== "/take") return new Response("Not found", { status: 404 });
    const timestamp = Date.now();
    const nextAt = (await this.state.storage.get<number>("next-at")) ?? timestamp;
    const grantedAt = Math.max(timestamp, nextAt);
    await this.state.storage.put("next-at", grantedAt + 334);
    return Response.json({ waitMs: Math.max(0, grantedAt - timestamp) });
  }
}

export default {
  async scheduled(_controller: ScheduledController, env: SyncEnv): Promise<void> {
    const startedAt = now();
    const run = await env.CATALOG_DB.prepare("INSERT INTO sync_runs (trigger, started_at, status) VALUES (?, ?, ?)")
      .bind("cron", startedAt, "running").run();
    try {
      const directorBackfillCount = await runDirectorBackfill(env);
      const countryBackfillCount = await runCountryBackfill(env);
      // Director enrichment temporarily receives the full rate-limited budget.
      // Resume the lower-priority trailer backfill automatically when finished.
      const trailerBackfillCount = directorBackfillCount === 0 ? await runTrailerBackfill(env) : 0;
      // During the one-time import, advance the discovery cursor on every
      // scheduled run. Later refreshes are deliberately reduced to daily.
      const timestamp = new Date();
      const initialImportRunning = await isInitialImportRunning(env);
      const isDailyRefreshSlot = timestamp.getUTCHours() === 0 && timestamp.getUTCMinutes() === 5;
      // The initial import walks the discovery cursor through historic pages.
      // Once it is complete, a daily refresh intentionally starts at page 1:
      // this fetches current popular/trending results instead of revisiting an
      // old, now-empty cursor page. Queue up to 100 titles per day.
      const seededCount = initialImportRunning
        ? await enqueueSeeds(env, 100)
        : isDailyRefreshSlot ? await enqueueSeeds(env, 100, 1) : 0;
      await env.CATALOG_DB.prepare("UPDATE sync_runs SET status = ?, seeded_count = ?, completed_at = ? WHERE id = ?")
        .bind("completed", countryBackfillCount + trailerBackfillCount + directorBackfillCount + seededCount, now(), run.meta.last_row_id).run();
    } catch (error) {
      await env.CATALOG_DB.prepare("UPDATE sync_runs SET status = ?, error = ?, completed_at = ? WHERE id = ?")
        .bind("failed", error instanceof Error ? error.message : String(error), now(), run.meta.last_row_id).run();
      throw error;
    }
  },

  async queue(batch: MessageBatch<SyncMessage>, env: SyncEnv): Promise<void> {
    for (const message of batch.messages) {
      try {
        if (message.body.kind === "media") await processMedia(env, message.body);
        else await processImage(env, message.body);
        message.ack();
      } catch (error) {
        if (isRetryable(error) && message.attempts < 5) message.retry({ delaySeconds: errorDelay(error, message.attempts) });
        else message.ack();
      }
    }
  },

  async fetch(request: Request, env: SyncEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return Response.json({ ok: true });
    if (request.method === "POST" && url.pathname === "/admin/seed") {
      if (!env.SYNC_ADMIN_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.SYNC_ADMIN_TOKEN}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      const rawLimit = Number(url.searchParams.get("limit") ?? 100);
      const seededCount = await enqueueSeeds(env, Math.max(1, Math.min(500, Math.floor(rawLimit))));
      return Response.json({ queued: seededCount });
    }
    return new Response("Not found", { status: 404 });
  },
};
