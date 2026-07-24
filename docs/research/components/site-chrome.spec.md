# Site Chrome Specification

## Overview

- Target files: `SiteHeader.astro`, `SiteFooter.astro`
- Interaction model: direct navigation plus click-driven mobile menu.

## Header

- 72px desktop / 62px mobile, sticky top, dark translucent background with blur.
- Inner width 1240px and 24px gutters.
- Brand is uppercase white text with an accent green dot; no copied logo asset.
- Desktop navigation is a horizontal 15px list. Search is 220px wide.
- Mobile hides navigation/search and reveals a 44px icon button plus full-width disclosure.
- Links transition from muted gray to white/accent in 160ms.

## Footer

- Background `#13151a`, top border `rgba(255,255,255,.09)`.
- Four desktop columns: brand 2fr, then three 1fr link groups; single column on mobile.
- Body copy 14px muted; headings 12px uppercase; links 14px.
- Includes TMDB attribution and no-playback disclaimer.

## Responsive

- Desktop mode at 900px and above.
- Mobile disclosure does not resize icon controls or overlap page content.
