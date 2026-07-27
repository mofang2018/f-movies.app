import { env } from "cloudflare:workers";
import { CatalogClient } from "./catalog";
import {
  fallbackDetails,
  fallbackGenrePage,
  fallbackGenres,
  fallbackHome,
  fallbackPage,
  fallbackTopRatedPage,
} from "../data/fallback";
import type { Genre, HomeData, MediaDetails, MediaItem, MediaType, PagedMedia } from "../types/media";

const apiBase = "https://api.themoviedb.org/3";

interface TmdbMediaRaw {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  genres?: Genre[];
  tagline?: string;
  runtime?: number | null;
  number_of_seasons?: number | null;
  status?: string;
  created_by?: Array<{ id: number; name: string }>;
  credits?: {
    cast?: Array<{
      id: number;
      name: string;
      character?: string;
      profile_path?: string | null;
    }>;
    crew?: Array<{
      id: number;
      name: string;
      job?: string;
    }>;
  };
  production_countries?: Array<{ iso_3166_1?: string }>;
  origin_country?: string[];
  similar?: TmdbPagedRaw;
  videos?: { results?: Array<{ site?: string; key?: string; type?: string; official?: boolean }> };
}

interface TmdbPagedRaw {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMediaRaw[];
}

interface CloudflareRequestInit extends RequestInit {
  cf?: {
    cacheEverything: boolean;
    cacheTtl: number;
  };
}

function normalizeMedia(raw: TmdbMediaRaw, fallbackType: MediaType = "movie"): MediaItem {
  const mediaType: MediaType = raw.media_type === "tv" || (!raw.title && Boolean(raw.name)) ? "tv" : fallbackType;
  return {
    id: raw.id,
    mediaType,
    title: raw.title ?? raw.name ?? "Untitled",
    overview: raw.overview ?? "",
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    releaseDate: raw.release_date ?? raw.first_air_date ?? "",
    voteAverage: raw.vote_average ?? 0,
    genreIds: raw.genre_ids ?? raw.genres?.map((genre) => genre.id) ?? [],
  };
}

function normalizePage(raw: TmdbPagedRaw, mediaType: MediaType): PagedMedia {
  return {
    page: raw.page,
    totalPages: Math.min(raw.total_pages, 500),
    totalResults: raw.total_results,
    results: raw.results
      .filter((item) => item.media_type !== "person")
      .map((item) => normalizeMedia(item, mediaType)),
  };
}

function trailerKeyFor(raw: TmdbMediaRaw): string | null {
  const videos = (raw.videos?.results ?? []).filter((video) => video.site === "YouTube" && /^[A-Za-z0-9_-]{11}$/.test(video.key ?? ""));
  return videos.find((video) => video.type === "Trailer" && video.official)?.key
    ?? videos.find((video) => video.type === "Trailer")?.key
    ?? videos.find((video) => video.type === "Teaser" && video.official)?.key
    ?? videos.find((video) => video.type === "Teaser")?.key
    ?? null;
}

export function getTmdbToken(): string {
  return (env as RuntimeEnv).TMDB_READ_ACCESS_TOKEN ?? import.meta.env.TMDB_READ_ACCESS_TOKEN ?? "";
}

export class TmdbClient {
  private readonly catalog = new CatalogClient();

  constructor(private readonly token: string) {}

  private async request<T>(path: string, params: Record<string, string | number> = {}, cacheTtl = 3600): Promise<T> {
    if (!this.token) throw new Error("TMDB_READ_ACCESS_TOKEN is not configured");

    const url = new URL(`${apiBase}${path}`);
    url.searchParams.set("language", "en-US");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

    const requestInit: CloudflareRequestInit = {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
      cf: { cacheEverything: true, cacheTtl },
    };
    const response = await fetch(url, requestInit);
    if (!response.ok) throw new Error(`TMDB request failed: ${response.status} ${path}`);
    return response.json() as Promise<T>;
  }

  async getHome(): Promise<HomeData> {
    try {
      const catalog = await this.catalog.getHome();
      if (catalog) return catalog;
    } catch {
      // The downloaded catalog is an optimization, not a single point of failure.
    }
    if (!this.token) return fallbackHome;
    try {
      const [trending, movies, tv, genres] = await Promise.all([
        this.request<TmdbPagedRaw>("/trending/all/week"),
        this.request<TmdbPagedRaw>("/movie/now_playing", { page: 1 }),
        this.request<TmdbPagedRaw>("/tv/popular", { page: 1 }),
        this.request<{ genres: Genre[] }>("/genre/movie/list", {}, 86400),
      ]);
      return {
        trending: normalizePage(trending, "movie").results,
        movies: normalizePage(movies, "movie").results,
        tv: normalizePage(tv, "tv").results,
        genres: genres.genres,
      };
    } catch {
      return fallbackHome;
    }
  }

  async getPopular(mediaType: MediaType, page: number): Promise<PagedMedia> {
    try {
      const catalog = await this.catalog.getPopular(mediaType, page);
      if (catalog) return catalog;
    } catch {
      // Continue with the existing TMDB and JSON fallbacks.
    }
    if (!this.token) return fallbackPage(mediaType, page);
    try {
      const raw = await this.request<TmdbPagedRaw>(`/${mediaType}/popular`, { page });
      return normalizePage(raw, mediaType);
    } catch {
      return fallbackPage(mediaType, page);
    }
  }

  async getByGenre(genreId: number, page: number): Promise<PagedMedia> {
    try {
      const catalog = await this.catalog.getByGenre(genreId, page);
      if (catalog) return catalog;
    } catch {
      // Continue with the existing TMDB and JSON fallbacks.
    }
    if (!this.token) return fallbackGenrePage(genreId, page);
    try {
      const raw = await this.request<TmdbPagedRaw>("/discover/movie", {
        with_genres: genreId,
        sort_by: "popularity.desc",
        page,
      });
      return normalizePage(raw, "movie");
    } catch {
      return fallbackGenrePage(genreId, page);
    }
  }

  async getByCountry(countryCode: string, page: number): Promise<PagedMedia> {
    try {
      const catalog = await this.catalog.getByCountry(countryCode, page);
      if (catalog) return catalog;
    } catch {
      // Country pages are intentionally local-catalog only.
    }
    return { page: Math.max(1, page), totalPages: 0, totalResults: 0, results: [] };
  }

  async getTopRated(page: number): Promise<PagedMedia> {
    try {
      const catalog = await this.catalog.getTopRated(page);
      if (catalog) return catalog;
    } catch {
      // Continue with the existing TMDB and JSON fallbacks.
    }
    if (!this.token) return fallbackTopRatedPage(page);
    try {
      const raw = await this.request<TmdbPagedRaw>("/movie/top_rated", { page });
      return normalizePage(raw, "movie");
    } catch {
      return fallbackTopRatedPage(page);
    }
  }

  async getGenres(): Promise<Genre[]> {
    try {
      const genres = await this.catalog.getGenres();
      if (genres) return genres;
    } catch {
      // Continue with the existing TMDB and JSON fallbacks.
    }
    if (!this.token) return fallbackGenres;
    try {
      const raw = await this.request<{ genres: Genre[] }>("/genre/movie/list", {}, 86400);
      return raw.genres;
    } catch {
      return fallbackGenres;
    }
  }

  async search(query: string, page: number): Promise<PagedMedia> {
    if (!query) return { page: 1, totalPages: 0, totalResults: 0, results: [] };
    try {
      const catalog = await this.catalog.search(query, page);
      if (catalog) return catalog;
    } catch {
      // Search results must come from the local catalogue only.
    }
    return { page: 1, totalPages: 0, totalResults: 0, results: [] };
  }

  async getDetails(mediaType: MediaType, id: number): Promise<MediaDetails> {
    try {
      const catalog = await this.catalog.getDetails(mediaType, id);
      if (catalog) return catalog;
    } catch {
      // Continue with the existing TMDB and JSON fallbacks.
    }
    if (!this.token) return fallbackDetails(mediaType, id);
    try {
      const raw = await this.request<TmdbMediaRaw>(`/${mediaType}/${id}`, {
        append_to_response: "credits,similar,videos",
      });
      const base = normalizeMedia(raw, mediaType);
      return {
        ...base,
        tagline: raw.tagline ?? "",
        runtime: raw.runtime ?? null,
        seasons: raw.number_of_seasons ?? null,
        status: raw.status ?? "",
        genres: raw.genres ?? [],
        directors: (raw.credits?.crew ?? [])
          .filter((person) => person.job === "Director")
          .map((person) => ({ id: person.id, name: person.name })),
        writers: (raw.credits?.crew ?? [])
          .filter((person) => person.job === "Writer" || person.job === "Screenplay")
          .filter((person, index, people) => people.findIndex((candidate) => candidate.id === person.id) === index)
          .map((person) => ({ id: person.id, name: person.name })),
        creators: (raw.created_by ?? []).map((person) => ({ id: person.id, name: person.name })),
        countries: [...new Set([
          ...(raw.production_countries ?? []).map((country) => country.iso_3166_1),
          ...(raw.origin_country ?? []),
        ].filter((code): code is string => /^[A-Z]{2}$/.test(code ?? "")))],
        cast: (raw.credits?.cast ?? []).slice(0, 10).map((person) => ({
          id: person.id,
          name: person.name,
          character: person.character ?? "",
          profilePath: person.profile_path ?? null,
        })),
        similar: (raw.similar?.results ?? []).slice(0, 12).map((item) => normalizeMedia(item, mediaType)),
        trailerKey: trailerKeyFor(raw),
      };
    } catch {
      return fallbackDetails(mediaType, id);
    }
  }
}
