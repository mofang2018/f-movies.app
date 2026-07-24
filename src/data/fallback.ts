import snapshotData from "./tmdb-snapshot.json";
import type { Genre, HomeData, MediaDetails, MediaItem, MediaType, PagedMedia } from "../types/media";

interface TmdbSnapshot {
  generatedAt: string;
  source: string;
  trending: MediaItem[];
  movies: MediaItem[];
  tv: MediaItem[];
  genres: Genre[];
  details: MediaDetails[];
}

const snapshot = snapshotData as unknown as TmdbSnapshot;

export const fallbackGenres: Genre[] = snapshot.genres;

export const fallbackHome: HomeData = {
  trending: snapshot.trending,
  movies: snapshot.movies,
  tv: snapshot.tv,
  genres: fallbackGenres,
};

export function fallbackPage(mediaType: MediaType, page = 1): PagedMedia {
  const results = mediaType === "movie" ? snapshot.movies : snapshot.tv;
  return { page, totalPages: 1, totalResults: results.length, results };
}

export function fallbackGenrePage(genreId: number, page = 1): PagedMedia {
  const results = snapshot.movies.filter((item) => item.genreIds.includes(genreId));
  return { page, totalPages: 1, totalResults: results.length, results };
}

export function fallbackTopRatedPage(page = 1): PagedMedia {
  const results = [...snapshot.movies]
    .filter((item) => item.voteAverage > 0)
    .sort((a, b) => b.voteAverage - a.voteAverage);
  return { page, totalPages: 1, totalResults: results.length, results };
}

export function fallbackCountryPage(page = 1): PagedMedia {
  return { page, totalPages: 0, totalResults: 0, results: [] };
}

export function fallbackDetails(mediaType: MediaType, id: number): MediaDetails {
  const exact = snapshot.details.find((item) => item.id === id && item.mediaType === mediaType);
  if (exact) return { ...exact, trailerKey: exact.trailerKey ?? null };

  const source = mediaType === "movie" ? snapshot.movies[0] : snapshot.tv[0];
  return {
    ...source,
    tagline: "",
    runtime: null,
    seasons: null,
    status: "",
    genres: fallbackGenres.filter((genre) => source.genreIds.includes(genre.id)),
    cast: [],
    similar: (mediaType === "movie" ? snapshot.movies : snapshot.tv)
      .filter((item) => item.id !== source.id)
      .slice(0, 12),
    trailerKey: null,
  };
}
