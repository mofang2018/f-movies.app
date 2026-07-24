# Media Card and Grid Specification

## Overview

- Target files: `MediaCard.astro`, `MediaSection.astro`, `MediaGrid.astro`.
- Interaction model: link navigation with hover/focus state.

## Media Card

- Poster area has stable `2 / 3` ratio and 6px radius.
- Poster fills the area; bottom overlay improves metadata contrast.
- Top-left badge: HD, green/black. Top-right badge: star icon plus one-decimal score.
- Title below image is 15px, two-line clamp. Metadata is 13px muted.
- Hover scales image to 1.045, reveals centered play/detail icon and colors title green.

## Grid

- Desktop: 6 columns, 18px horizontal gap, 30px vertical gap.
- Tablet: 4 columns.
- Mobile: 2 columns, 12px gap.

## Section

- Header uses title plus short accent rule and right-aligned “View all” link.
- Section vertical spacing is 52px desktop / 38px mobile.
