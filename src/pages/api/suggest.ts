import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { mediaPath } from "../../lib/media-url";
import type { MediaType } from "../../types/media";

const minimumQueryLength = 3;
const maximumQueryLength = 80;
const resultLimit = 6;
const edgeCache = (caches as typeof caches & { default: Cache }).default;

interface SuggestionRow {
  media_type: MediaType;
  tmdb_id: number;
  title: string;
  release_date: string;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Type": "application/json; charset=UTF-8",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function normalizedQuery(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .slice(0, maximumQueryLength);
}

export const GET: APIRoute = async ({ url }) => {
  const query = normalizedQuery(url.searchParams.get("q") ?? "");
  if (query.length < minimumQueryLength || !env.CATALOG_DB) return json({ results: [] });

  const cacheKey = new Request(new URL(`/api/suggest?q=${encodeURIComponent(query)}`, url.origin));
  const cached = await edgeCache.match(cacheKey);
  if (cached) return cached;

  const match = query.split(" ").map((term) => `"${term}"*`).join(" AND ");
  const result = await env.CATALOG_DB.prepare(`SELECT m.media_type, m.tmdb_id, m.title, m.release_date
    FROM media_search
    JOIN media m ON media_search.rowid = m.rowid
    WHERE media_search MATCH ?
    LIMIT ?`).bind(match, resultLimit).all<SuggestionRow>();

  const response = json({
    results: result.results.map((item) => ({
      title: item.title,
      year: /^\d{4}/.test(item.release_date) ? item.release_date.slice(0, 4) : null,
      url: mediaPath(item.media_type, item.tmdb_id, item.title),
    })),
  });
  await edgeCache.put(cacheKey, response.clone());
  return response;
};
