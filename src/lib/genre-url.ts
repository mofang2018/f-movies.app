import type { Genre } from "../types/media";

/** Produce readable, stable paths from TMDB's English genre names. */
export function genreSlug(name: string): string {
  return name
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function genrePath(genre: Pick<Genre, "name">): string {
  return `/genre/${genreSlug(genre.name)}`;
}
