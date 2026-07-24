export type ImageSize = "w185" | "w342" | "w500" | "w780" | "w1280" | "original";

const tmdbImageHost = "https://image.tmdb.org/t/p";

export function getImageUrl(path: string | null, size: ImageSize = "w500"): string {
  if (!path) return "/images/poster-placeholder.svg";

  if (import.meta.env.DEV) return `${tmdbImageHost}/${size}${path}`;

  const configuredHost = import.meta.env.PUBLIC_IMAGE_CDN_URL?.replace(/\/$/, "");
  const imageHost = configuredHost || "https://images.f-movies.app";
  return `${imageHost}/${size}/${path.replace(/^\//, "")}`;
}
