import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { navigationCountries } from "../data/navigation";
import { absoluteUrl, xml } from "../lib/seo";

interface GenreRow {
  genre_id: number;
}

interface CountryRow {
  country_code: string;
}

const xmlHeaders = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export const GET: APIRoute = async () => {
  const database = (env as RuntimeEnv).CATALOG_DB;
  if (!database) return new Response("Catalog unavailable", { status: 503 });
  const [genresResult, countriesResult, catalogResult] = await database.batch([
    database.prepare("SELECT DISTINCT genre_id FROM media_genres ORDER BY genre_id"),
    database.prepare("SELECT DISTINCT country_code FROM media_countries WHERE media_type = 'movie' ORDER BY country_code"),
    database.prepare("SELECT MAX(updated_at) AS lastmod FROM media"),
  ]);
  const genres = genresResult.results as GenreRow[];
  const countries = countriesResult.results as CountryRow[];
  const countrySlugs = new Map<string, string>(navigationCountries.map((country) => [country.code, country.slug]));
  const paths = [
    "/",
    "/home",
    "/movies",
    "/tv-series",
    "/top-imdb",
    ...genres.map((genre) => `/genre/${genre.genre_id}`),
    ...countries.map((country) => countrySlugs.get(country.country_code)).filter(Boolean).map((slug) => `/country/${slug}`),
  ];
  const lastmod = (catalogResult.results[0] as { lastmod?: string } | undefined)?.lastmod ?? new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((path) => `  <url><loc>${xml(absoluteUrl(path))}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: xmlHeaders });
};
