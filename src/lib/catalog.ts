import { env } from "cloudflare:workers";
import type { Genre, HomeData, MediaCredit, MediaDetails, MediaItem, MediaPerson, MediaType, PagedMedia } from "../types/media";

const pageSize = 20;
const mediaColumns = "media_type, tmdb_id, title, overview, release_date, vote_average, poster_path, backdrop_path, runtime, seasons, status";
const mediaColumnsFor = (alias: string): string => mediaColumns.split(", ").map((column) => `${alias}.${column}`).join(", ");

interface CatalogMediaRow {
  media_type: MediaType;
  tmdb_id: number;
  title: string;
  overview: string;
  release_date: string;
  vote_average: number;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime: number | null;
  seasons: number | null;
  status: string | null;
}

interface CatalogGenreRow {
  genre_id: number;
  name: string;
}

interface CatalogCastRow {
  person_id: number;
  name: string;
  character_name: string;
  profile_path: string | null;
}

interface CatalogPersonRow {
  person_id: number;
  name: string;
}

function db(): D1Database | undefined {
  return (env as RuntimeEnv).CATALOG_DB;
}

function toMedia(row: CatalogMediaRow, genreIds: number[] = []): MediaItem {
  return {
    id: row.tmdb_id,
    mediaType: row.media_type,
    title: row.title,
    overview: row.overview,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    releaseDate: row.release_date,
    voteAverage: row.vote_average,
    genreIds,
  };
}

async function rowsWithGenres(rows: CatalogMediaRow[], database: D1Database): Promise<MediaItem[]> {
  if (!rows.length) return [];
  const predicates = rows.map(() => "(media_type = ? AND tmdb_id = ?)").join(" OR ");
  const binds = rows.flatMap((row) => [row.media_type, row.tmdb_id]);
  const genres = await database.prepare(
    `SELECT media_type, tmdb_id, genre_id FROM media_genres WHERE ${predicates} ORDER BY media_type, tmdb_id, genre_id`,
  ).bind(...binds).all<{ media_type: MediaType; tmdb_id: number; genre_id: number }>();
  const genreIdsByMedia = new Map<string, number[]>();
  for (const genre of genres.results) {
    const key = `${genre.media_type}:${genre.tmdb_id}`;
    genreIdsByMedia.set(key, [...(genreIdsByMedia.get(key) ?? []), genre.genre_id]);
  }
  return rows.map((row) => toMedia(row, genreIdsByMedia.get(`${row.media_type}:${row.tmdb_id}`) ?? []));
}

async function countAndRows(
  database: D1Database,
  where: string,
  binds: Array<number | string>,
  orderBy: string,
  page: number,
): Promise<PagedMedia> {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;
  const [countResult, rowsResult] = await database.batch([
    database.prepare(`SELECT COUNT(*) AS total FROM media ${where}`).bind(...binds),
    database.prepare(`SELECT ${mediaColumns} FROM media ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
      .bind(...binds, pageSize, offset),
  ]);
  const total = Number((countResult.results[0] as { total?: number } | undefined)?.total ?? 0);
  const rows = rowsResult.results as CatalogMediaRow[];
  return {
    page: safePage,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    totalResults: total,
    results: await rowsWithGenres(rows, database),
  };
}

function editDistanceWithinOne(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let leftIndex = 0;
  let rightIndex = 0;
  let differences = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    differences += 1;
    if (differences > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }
  return true;
}

export class CatalogClient {
  static isAvailable(): boolean {
    return Boolean(db());
  }

  async getHome(): Promise<HomeData | null> {
    const database = db();
    if (!database) return null;
    const [trending, movies, tv, genres] = await Promise.all([
      database.prepare(`SELECT ${mediaColumns} FROM media ORDER BY popularity DESC LIMIT ?`).bind(pageSize).all<CatalogMediaRow>(),
      database.prepare(`SELECT ${mediaColumns} FROM media WHERE media_type = ? ORDER BY popularity DESC LIMIT ?`)
        .bind("movie", pageSize).all<CatalogMediaRow>(),
      database.prepare(`SELECT ${mediaColumns} FROM media WHERE media_type = ? ORDER BY popularity DESC LIMIT ?`)
        .bind("tv", pageSize).all<CatalogMediaRow>(),
      database.prepare("SELECT genre_id, name FROM genres ORDER BY name").all<CatalogGenreRow>(),
    ]);
    if (!trending.results.length) return null;
    const [trendingItems, movieItems, tvItems] = await Promise.all([
      rowsWithGenres(trending.results, database),
      rowsWithGenres(movies.results, database),
      rowsWithGenres(tv.results, database),
    ]);
    return {
      trending: trendingItems,
      movies: movieItems,
      tv: tvItems,
      genres: genres.results.map((genre) => ({ id: genre.genre_id, name: genre.name })),
    };
  }

  async getPopular(mediaType: MediaType, page: number): Promise<PagedMedia | null> {
    const database = db();
    if (!database) return null;
    const result = await countAndRows(database, "WHERE media_type = ?", [mediaType], "popularity DESC", page);
    return result.totalResults ? result : null;
  }

  async getByGenre(genreId: number, page: number): Promise<PagedMedia | null> {
    const database = db();
    if (!database) return null;
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * pageSize;
    const [countResult, rowsResult] = await database.batch([
      database.prepare("SELECT COUNT(*) AS total FROM media_genres WHERE genre_id = ?").bind(genreId),
      database.prepare(`SELECT ${mediaColumnsFor("m")}
        FROM media m JOIN media_genres mg ON mg.media_type = m.media_type AND mg.tmdb_id = m.tmdb_id
        WHERE mg.genre_id = ? ORDER BY m.popularity DESC LIMIT ? OFFSET ?`).bind(genreId, pageSize, offset),
    ]);
    const total = Number((countResult.results[0] as { total?: number } | undefined)?.total ?? 0);
    if (!total) return null;
    const rows = rowsResult.results as CatalogMediaRow[];
    return {
      page: safePage,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      totalResults: total,
      results: await rowsWithGenres(rows, database),
    };
  }

  async getByCountry(countryCode: string, page: number): Promise<PagedMedia | null> {
    const database = db();
    if (!database) return null;
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * pageSize;
    const [countResult, rowsResult] = await database.batch([
      database.prepare("SELECT COUNT(*) AS total FROM media_countries WHERE country_code = ? AND media_type = 'movie'").bind(countryCode),
      database.prepare(`SELECT ${mediaColumnsFor("m")}
        FROM media m JOIN media_countries mc ON mc.media_type = m.media_type AND mc.tmdb_id = m.tmdb_id
        WHERE mc.country_code = ? AND m.media_type = 'movie' ORDER BY m.popularity DESC LIMIT ? OFFSET ?`).bind(countryCode, pageSize, offset),
    ]);
    const total = Number((countResult.results[0] as { total?: number } | undefined)?.total ?? 0);
    if (!total) return null;
    const rows = rowsResult.results as CatalogMediaRow[];
    return {
      page: safePage,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      totalResults: total,
      results: await rowsWithGenres(rows, database),
    };
  }

  async getTopRated(page: number): Promise<PagedMedia | null> {
    const database = db();
    if (!database) return null;
    const result = await countAndRows(
      database,
      "WHERE media_type = ? AND vote_count >= ?",
      ["movie", 100],
      "vote_average DESC, vote_count DESC",
      page,
    );
    return result.totalResults ? result : null;
  }

  async getGenres(): Promise<Genre[] | null> {
    const database = db();
    if (!database) return null;
    const genres = await database.prepare("SELECT genre_id, name FROM genres ORDER BY name").all<CatalogGenreRow>();
    return genres.results.length ? genres.results.map((genre) => ({ id: genre.genre_id, name: genre.name })) : null;
  }

  async search(query: string, page: number): Promise<PagedMedia | null> {
    const database = db();
    if (!database || !query) return null;
    const normalizedQuery = query.trim().replace(/[^\p{L}\p{N}]+/gu, " ");
    if (!normalizedQuery) return null;
    const searchPage = async (searchQuery: string): Promise<PagedMedia> => {
      const match = searchQuery.split(/\s+/).map((term) => `"${term}"*`).join(" AND ");
      const safePage = Math.max(1, page);
      const offset = (safePage - 1) * pageSize;
      const [countResult, rowsResult] = await database.batch([
        database.prepare("SELECT COUNT(*) AS total FROM media_search WHERE media_search MATCH ?").bind(match),
        database.prepare(`SELECT ${mediaColumnsFor("m")} FROM media m
          JOIN media_search ON media_search.rowid = m.rowid
          WHERE media_search MATCH ? ORDER BY m.popularity DESC LIMIT ? OFFSET ?`).bind(match, pageSize, offset),
      ]);
      const total = Number((countResult.results[0] as { total?: number } | undefined)?.total ?? 0);
      const rows = rowsResult.results as CatalogMediaRow[];
      return {
        page: safePage,
        totalPages: total ? Math.ceil(total / pageSize) : 0,
        totalResults: total,
        results: await rowsWithGenres(rows, database),
      };
    };

    const exact = await searchPage(normalizedQuery);
    if (exact.totalResults || page > 1 || normalizedQuery.includes(" ") || normalizedQuery.length < 5) return exact;

    const prefix = normalizedQuery.slice(0, 3);
    const candidates = await database.prepare(`SELECT m.title FROM media m
      JOIN media_search ON media_search.rowid = m.rowid
      WHERE media_search MATCH ? ORDER BY m.popularity DESC LIMIT 100`).bind(`"${prefix}"*`).all<{ title: string }>();
    const correction = candidates.results
      .flatMap((candidate) => candidate.title.toLowerCase().split(/[^\p{L}\p{N}]+/u))
      .find((word) => word.length >= 5 && editDistanceWithinOne(normalizedQuery.toLowerCase(), word));
    if (!correction) return exact;

    const corrected = await searchPage(correction);
    return corrected.totalResults ? { ...corrected, correctedQuery: correction } : exact;
  }

  async getDetails(mediaType: MediaType, id: number): Promise<MediaDetails | null> {
    const database = db();
    if (!database) return null;
    const media = await database.prepare(`SELECT ${mediaColumns} FROM media WHERE media_type = ? AND tmdb_id = ?`)
      .bind(mediaType, id).first<CatalogMediaRow>();
    if (!media) return null;
    const [genresResult, directorsResult, writersResult, creatorsResult, countriesResult, castResult, similarResult, trailerResult] = await database.batch([
      database.prepare(`SELECT g.genre_id, g.name FROM genres g JOIN media_genres mg ON mg.genre_id = g.genre_id
        WHERE mg.media_type = ? AND mg.tmdb_id = ? ORDER BY g.name`).bind(mediaType, id),
      database.prepare("SELECT person_id, name FROM media_directors WHERE media_type = ? AND tmdb_id = ? ORDER BY director_order")
        .bind(mediaType, id),
      database.prepare("SELECT person_id, name FROM media_writers WHERE media_type = ? AND tmdb_id = ? ORDER BY writer_order")
        .bind(mediaType, id),
      database.prepare("SELECT person_id, name FROM media_creators WHERE media_type = ? AND tmdb_id = ? ORDER BY creator_order")
        .bind(mediaType, id),
      database.prepare("SELECT country_code FROM media_countries WHERE media_type = ? AND tmdb_id = ? ORDER BY country_code")
        .bind(mediaType, id),
      database.prepare("SELECT person_id, name, character_name, profile_path FROM media_cast WHERE media_type = ? AND tmdb_id = ? ORDER BY cast_order LIMIT 10")
        .bind(mediaType, id),
      database.prepare(`SELECT ${mediaColumns} FROM media WHERE media_type = ? AND tmdb_id != ? ORDER BY popularity DESC LIMIT 12`)
        .bind(mediaType, id),
      database.prepare("SELECT youtube_key FROM media_trailers WHERE media_type = ? AND tmdb_id = ?")
        .bind(mediaType, id),
    ]);
    const genres = (genresResult.results as CatalogGenreRow[]).map((genre) => ({ id: genre.genre_id, name: genre.name }));
    const directors: MediaPerson[] = (directorsResult.results as CatalogPersonRow[]).map((person) => ({ id: person.person_id, name: person.name }));
    const writers: MediaPerson[] = [...new Map((writersResult.results as CatalogPersonRow[]).map((person) => [person.person_id, { id: person.person_id, name: person.name }])).values()];
    const creators: MediaPerson[] = (creatorsResult.results as CatalogPersonRow[]).map((person) => ({ id: person.person_id, name: person.name }));
    const countries = (countriesResult.results as Array<{ country_code: string }>).map((country) => country.country_code);
    const cast: MediaCredit[] = (castResult.results as CatalogCastRow[]).map((person) => ({
      id: person.person_id,
      name: person.name,
      character: person.character_name,
      profilePath: person.profile_path,
    }));
    const similarRows = similarResult.results as CatalogMediaRow[];
    return {
      ...toMedia(media, genres.map((genre) => genre.id)),
      tagline: "",
      runtime: media.runtime,
      seasons: media.seasons,
      status: media.status ?? "",
      genres,
      directors,
      writers,
      creators,
      countries,
      cast,
      similar: await rowsWithGenres(similarRows, database),
      trailerKey: (trailerResult.results[0] as { youtube_key?: string } | undefined)?.youtube_key ?? null,
    };
  }
}
