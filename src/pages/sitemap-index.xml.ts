import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { absoluteUrl, sitemapShardSize, xml } from "../lib/seo";
import type { MediaType } from "../types/media";

interface ShardRow {
  media_type: MediaType;
  shard: number;
  lastmod: string;
}

const xmlHeaders = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export const GET: APIRoute = async () => {
  const database = (env as RuntimeEnv).CATALOG_DB;
  if (!database) return new Response("Catalog unavailable", { status: 503 });
  const [shardsResult, catalogResult] = await database.batch([
    database.prepare(`SELECT media_type, CAST(tmdb_id / ? AS INTEGER) AS shard,
    MAX(updated_at) AS lastmod
    FROM media GROUP BY media_type, shard ORDER BY media_type, shard`).bind(sitemapShardSize),
    database.prepare("SELECT MAX(updated_at) AS lastmod FROM media"),
  ]);
  const shards = shardsResult.results as ShardRow[];
  const staticLastmod = (catalogResult.results[0] as { lastmod?: string } | undefined)?.lastmod ?? new Date().toISOString();
  const entries = [
    { loc: absoluteUrl("/sitemap-static.xml"), lastmod: staticLastmod },
    ...shards.map((shard) => ({
      loc: absoluteUrl(`/sitemap-${shard.media_type}-${shard.shard}.xml`),
      lastmod: shard.lastmod,
    })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map((entry) => `  <sitemap><loc>${xml(entry.loc)}</loc><lastmod>${xml(entry.lastmod)}</lastmod></sitemap>`)
    .join("\n")}\n</sitemapindex>\n`;
  return new Response(body, { headers: xmlHeaders });
};
