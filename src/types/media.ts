export type MediaType = "movie" | "tv";

export interface MediaItem {
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string;
  voteAverage: number;
  genreIds: number[];
}

export interface Genre {
  id: number;
  name: string;
}

export interface MediaCredit {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface MediaPerson {
  id: number;
  name: string;
}

export interface MediaDetails extends MediaItem {
  tagline: string;
  runtime: number | null;
  seasons: number | null;
  status: string;
  genres: Genre[];
  directors: MediaPerson[];
  countries: string[];
  cast: MediaCredit[];
  similar: MediaItem[];
  trailerKey: string | null;
}

export interface PagedMedia {
  page: number;
  totalPages: number;
  totalResults: number;
  results: MediaItem[];
  correctedQuery?: string;
}

export interface HomeData {
  trending: MediaItem[];
  movies: MediaItem[];
  tv: MediaItem[];
  genres: Genre[];
}
