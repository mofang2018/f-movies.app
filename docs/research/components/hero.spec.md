# Hero Specification

## Overview

- Target file: `Hero.astro`
- Interaction model: timed rotation with click-driven dot selection.

## Layout

- Full-width, 650px desktop / 560px mobile, overflow hidden.
- Backdrop is an absolute full-bleed image with `object-fit: cover`.
- Overlays: left-to-right dark gradient and bottom fade into page background.
- Copy sits in a 1240px inner wrapper, aligned to the bottom third, max width 650px.
- Title 58px/1.03 desktop, 38px mobile, weight 800.
- Metadata is a wrapping row with HD badge, year, media type and star rating.
- Primary action is green with black text; secondary action is a quiet outline.

## States

- Only the active slide is visible and interactive.
- Crossfade/translate transition lasts 450ms.
- Active dot expands from 8px to 28px.
- Auto-rotate every 7 seconds; paused when reduced motion is requested.

## Assets

- Backdrops use `getImageUrl(path, "w1280")`, which selects the Cloudflare image host in production.
