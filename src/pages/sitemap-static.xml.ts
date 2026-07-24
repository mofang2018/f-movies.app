import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { navigationCountries } from "../data/navigation";
import { absoluteUrl, sitemapCacheControl, xml } from "../lib/seo";

interface GenreRow {
  genre_id: number;
}

interface CountryRow {
  country_code: string;
}

const xmlHeaders = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": sitemapCacheControl,
};

export const GET: APIRoute = async () => {
  const database = (env as RuntimeEnv).CATALOG_DB;
  if (!database) return new Response("Catalog unavailable", { status: 503 });
  const [genresResult, countriesResult] = await database.batch([
    database.prepare("SELECT DISTINCT genre_id FROM media_genres ORDER BY genre_id"),
    database.prepare("SELECT DISTINCT country_code FROM media_countries WHERE media_type = 'movie' ORDER BY country_code"),
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
    "/dmca",
    ...genres.map((genre) => `/genre/${genre.genre_id}`),
    ...countries.map((country) => countrySlugs.get(country.country_code)).filter(Boolean).map((slug) => `/country/${slug}`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((path) => `  <url><loc>${xml(absoluteUrl(path))}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: xmlHeaders });
};
