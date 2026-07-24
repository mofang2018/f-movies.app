# Layout Architecture

- Document-level vertical scrolling with a sticky 72px desktop / 62px mobile header.
- Full-bleed Hero and detail backdrops; content aligns to a centered 1240px wrapper.
- Catalog cards use CSS Grid: six columns desktop, four tablet and two mobile.
- Poster and cast images use fixed aspect ratios to prevent layout shift.
- Content sections are unframed bands; only repeated media items and the native dialog are framed surfaces.
- Footer changes from four columns to three, then two columns at smaller breakpoints.
- No horizontal document overflow is permitted. The mobile share action row is the only intentional nested horizontal scroller.
