# F.MOVIES

An Astro and Cloudflare movie discovery site powered by TMDB. The project follows the research, component specification and visual QA workflow from `JCodesMore/ai-website-cloner-template`, adapted to Astro for a smaller runtime footprint.

## Local development

Requires Node.js 22.12 or newer.

```bash
npm install
cp .env.example .env
# Add TMDB_READ_ACCESS_TOKEN to .env
npm run dev
```

When no TMDB token is configured, the app uses a local snapshot downloaded from TMDB's official website so all routes remain testable with current data.

Refresh that snapshot when you want to update the local catalog:

```bash
npm run data:refresh
```

This downloads metadata and TMDB image paths only. Image files stay on TMDB's CDN in development and are routed through the configured Cloudflare image host in production.

For the planned API-driven bulk catalog sync, D1 metadata store and R2 image cache, see [the batch sync design](docs/API_BATCH_SYNC_DESIGN.md). The current `data:refresh` command remains the lightweight website-snapshot fallback until that architecture is implemented.

## TMDB API batch sync

The Cloudflare resources are defined in `wrangler.sync.jsonc`. Apply the D1 schema, set the two Worker secrets, then deploy the background sync Worker:

```bash
npm run sync:migrate
npx wrangler secret put TMDB_READ_ACCESS_TOKEN --config wrangler.sync.jsonc
npx wrangler secret put SYNC_ADMIN_TOKEN --config wrangler.sync.jsonc
npm run sync:deploy
```

During the initial backfill, the Cron runs every 15 minutes and seeds at most 25 catalog entries per run. Posters and backdrops are written directly to R2 by the media consumer, rather than creating additional Queue messages per image; this keeps Queue free-tier usage below its daily operation limit. After the desired catalog size is reached, change the Cron back to an hourly schedule. The sync Worker intentionally has no public `workers.dev` route; expose a one-off seed endpoint only behind Cloudflare Access or a Service Binding when an operator console is added.

## Checks

```bash
npm run check
npm run build
```

## Cloudflare deployment

Deploy the image proxy first, then attach `images.f-movies.app` as its custom domain in Cloudflare:

```bash
npm run deploy:images
```

Store the TMDB token as a Worker secret and deploy the app:

```bash
npx wrangler secret put TMDB_READ_ACCESS_TOKEN
npm run deploy
```

The production build sends poster and backdrop URLs to `https://images.f-movies.app`. Set `PUBLIC_IMAGE_CDN_URL` at build time to use a different Cloudflare image domain.

## Scope

The current version includes home, catalog, genre, search and details pages. It intentionally does not host or play video content.
