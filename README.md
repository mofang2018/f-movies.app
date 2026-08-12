# FMOVIES

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

The initial historic import has completed. The Cron runs at `00:20`, `06:20`, `12:20`, and `18:20 UTC` (08:20, 14:20, 20:20, and 02:20 China Standard Time). Every five days it checks recent movie releases, upcoming movies, recently premiered/airing TV series, and short-term trending lists; it queues at most 100 titles that are not already in D1 (normally up to 50 movies and 50 TV series, with an unused allocation given to the other type). Every queued movie or series is hydrated by one TMDB detail request with `credits,videos`: the site stores the title, synopsis, dates, rating, popularity, status, genres, countries, runtime/seasons, top cast, directors plus Writers/Screenplay for movies or Creators for TV, and the preferred YouTube trailer when TMDB supplies one. Posters and backdrops are written directly to R2 by the media consumer, rather than creating additional Queue messages per image; this keeps Queue usage low. All TMDB calls remain globally rate-limited to roughly 3 requests/second. The sync Worker intentionally has no public `workers.dev` route; expose a one-off seed endpoint only behind Cloudflare Access or a Service Binding when an operator console is added.

From 13 August through 13 November 2026, the 02:20 China Standard Time run also expands the historic catalogue. It resumes after the prior discovery cursor, scans ten `/discover/movie` pages and ten `/discover/tv` pages, then queues up to 200 missing titles (normally 100 movies and 100 TV series) for the same complete-detail pipeline. It uses its own persistent `historical-catalog-cursor`, does not overwrite existing entries, and rotates among popularity, vote-count and release-date orderings when an individual TMDB discovery sort reaches its 500-page limit. It stops automatically after the three-month window.

Country pages use readable paths such as `/country/united-states`. They query the local D1 catalog only: each synchronized title stores its TMDB production/origin country code in `media_countries`, so opening a Country page never makes a user-facing TMDB API request.

## Checks

```bash
npm run check
npm run build
```

## Cloudflare deployment

Deploy the image proxy first, then attach `images.watchfmovies.org` as its custom domain in Cloudflare:

```bash
npm run deploy:images
```

Store the TMDB token as a Worker secret and deploy the app:

```bash
npx wrangler secret put TMDB_READ_ACCESS_TOKEN
npm run deploy
```

The production build sends poster and backdrop URLs to `https://images.watchfmovies.org`. Set `PUBLIC_IMAGE_CDN_URL` at build time to use a different Cloudflare image domain.

## Scope

The current version includes home, catalog, genre, search and details pages. It intentionally does not host or play video content.
