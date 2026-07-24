import { mediaPath } from "./media-url";
import type { MediaType } from "../types/media";

export const siteOrigin = "https://f-movies.app";
export const sitemapShardSize = 1_000;

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
