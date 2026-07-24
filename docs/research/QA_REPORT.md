# QA Report

## Automated checks

- `astro check`: 28 files, 0 errors, 0 warnings, 0 hints.
- `astro build`: Cloudflare server build completed successfully.
- Main Worker dry run: 669.79 KiB upload, 167.88 KiB gzip.
- Image Worker dry run: 1.82 KiB upload, 0.85 KiB gzip.
- Credential scan: supplied TMDB API Key and Read Access Token are absent from project files.

## Route smoke test

All returned HTTP 200 locally: `/`, `/movies`, `/tv-series`, `/search?q=Inception`, `/genre/28`, `/movie/27205`, `/tv/1396`.

## Browser QA

- Desktop viewport: 18 cards, 23 images, no broken images, no horizontal overflow.
- Mobile viewport (390x844): two-column 173px card grid, no document overflow.
- Mobile menu opens/closes and updates `aria-expanded`.
- Search result for `Inception` returns the matching card.
- Movie detail route renders metadata and recommendations.
- Watch action opens and closes the no-playback dialog.
- Reference screenshots saved in `docs/design-references/`.

## Environment note

The current machine could not connect to `api.themoviedb.org` during final QA. Both shell and Worker requests timed out. The site therefore used its built-in fallback catalog for visual validation. TMDB requests have an eight-second timeout and automatically fall back, while production will use live data whenever the upstream is reachable.
