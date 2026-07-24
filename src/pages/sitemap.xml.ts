import type { APIRoute } from "astro";
import { GET as sitemapIndex } from "./sitemap-index.xml";

// Keep the standard sitemap.xml entry point while sitemap-index.xml remains
// available for tools that already use it.
export const GET: APIRoute = sitemapIndex;
