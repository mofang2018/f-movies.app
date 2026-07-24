import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { absoluteUrl, sitemapCacheControl, sitemapMediaPath, sitemapShardSize, xml } from "../lib/seo";
import type { MediaType } from "../types/media";

interface MediaRow {
  media_type: MediaType;
  tmdb_id: number;
  title: string;
  updated_at: string;
}

const xmlHeaders = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": sitemapCacheControl,
};

export const GET: APIRoute = async ({ params }) => {
  const mediaType = params.mediaType;
  const shard = Number(params.shard);
  if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isSafeInteger(shard) || shard < 0) {
    return new Response(null, { status: 404 });
  }
  const database = (env as RuntimeEnv).CATALOG_DB;
  if (!database) return new Response("Catalog unavailable", { status: 503 });
  const lower = shard * sitemapShardSize;
  const upper = lower + sitemapShardSize;
  const rows = await database.prepare(`SELECT media_type, tmdb_id, title, updated_at FROM media
    WHERE media_type = ? AND tmdb_id >= ? AND tmdb_id < ? ORDER BY tmdb_id`).bind(mediaType, lower, upper).all<MediaRow>();
  if (!rows.results.length) return new Response(null, { status: 404 });
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.results
    .map((row) => `  <url><loc>${xml(absoluteUrl(sitemapMediaPath(row.media_type, row.tmdb_id, row.title)))}</loc><lastmod>${xml(row.updated_at)}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: xmlHeaders });
};
