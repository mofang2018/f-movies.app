import { mediaPath } from "./media-url";
import type { MediaType } from "../types/media";

export const siteOrigin = "https://f-movies.app";
export const sitemapShardSize = 1_000;
// After the initial catalogue import, metadata changes are deliberately
// infrequent. A 24-hour edge TTL keeps D1 reads and Worker work low while
// each sitemap entry still retains its exact D1 updated_at value.
export const catalogCacheControl = "public, s-maxage=86400";
export const sitemapCacheControl = "public, s-maxage=86400";

const xmlEscapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&apos;",
};

export function xml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => xmlEscapes[character]);
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteOrigin).href;
}

export function canonicalPath(pathname: string, page: number): string {
  if (page <= 1) return pathname;
  const params = new URLSearchParams({ page: String(page) });
  return `${pathname}?${params}`;
}

export function paginationLinks(pathname: string, page: number, totalPages: number): Array<{ rel: "prev" | "next"; href: string }> {
  const links: Array<{ rel: "prev" | "next"; href: string }> = [];
  const pageHref = (targetPage: number): string => {
    const url = new URL(pathname, siteOrigin);
    if (targetPage <= 1) url.searchParams.delete("page");
    else url.searchParams.set("page", String(targetPage));
    return url.href;
  };
  if (page > 1) links.push({ rel: "prev", href: pageHref(page - 1) });
  if (page < totalPages) links.push({ rel: "next", href: pageHref(page + 1) });
  return links;
}

export function sitemapMediaPath(mediaType: MediaType, tmdbId: number, title: string): string {
  return mediaPath(mediaType, tmdbId, title);
}
