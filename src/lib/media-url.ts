import type { MediaItem, MediaType } from "../types/media";

/**
 * Produces stable, human-readable URLs such as
 * /movie/the-shawshank-redemption-278. The TMDB id is retained so that a
 * title rename never changes a title's identity or causes an ambiguous URL.
 */
export function slugifyTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return slug || "title";
}

export function mediaPath(mediaType: MediaType, id: number, title: string): string {
  return `/${mediaType}/${slugifyTitle(title)}-${id}`;
}

export function mediaUrl(item: Pick<MediaItem, "mediaType" | "id" | "title">): string {
  return mediaPath(item.mediaType, item.id, item.title);
}

export function mediaIdFromSlug(value: string | undefined): number | null {
  if (!value) return null;
  // A title is required. Pure ids were never public URLs for this site.
  if (!value.includes("-")) return null;
  const match = value.match(/(?:^|-)(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
