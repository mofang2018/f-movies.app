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
