# Tech Stack Analysis

## Reference site

The reference uses server-rendered HTML plus client-side data loading, system fonts, a dark custom CSS theme, a third-party movie data source, responsive grids and inline SVG social/search icons. The `/home` content request was unavailable during inspection, leaving twenty-card loading containers in each section.

## Chosen equivalent

- Astro SSR instead of a hydrated application shell.
- Cloudflare Workers instead of a persistent Node server.
- TMDB API v3 through a server-only client.
- Cloudflare image domain abstraction for poster/backdrop caching and transformation.
- Component-scoped CSS and global design tokens instead of a UI framework.
- Lucide icons rendered at build/server time.

This keeps the clone workflow and visual fidelity while reducing JavaScript, memory usage and deployment complexity.
