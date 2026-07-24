# Catalog and Details Specification

## Catalog pages

- Target files: list/search/genre routes and `Pagination.astro`.
- Intro band starts below sticky header and uses a compact title, result count and optional query label.
- Grid follows media-card specification.
- Pagination uses fixed 40px controls and keeps only nearby page numbers visible.
- Empty search results show an unframed centered state with a search icon and revised search form.

## Details page

- Full-width backdrop with strong overlays, poster and copy in a two-column content wrapper.
- Poster is 280px desktop and hidden only when no poster is available.
- Metadata includes score, year, duration/seasons, status and genres.
- “Watch now” opens a native dialog explaining that playback is unavailable.
- Cast uses a horizontally wrapping portrait list; similar titles reuse `MediaSection`.

## Responsive

- Details stack at 768px; title scales from 52px to 36px.
- Dialog max width 480px and fits within 16px mobile gutters.
