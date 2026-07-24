# Behaviors

## Reference observations

- Header navigation uses dropdowns for Movies and Genres on desktop.
- Search submits a query page; there is no complex autocomplete requirement in the first version.
- Poster cards reveal stronger overlay and action affordance on hover.
- Desktop content uses dense multi-column grids; mobile changes to two columns.
- Reference Hero is data-driven and currently exposes a loading state when its upstream content request fails.

## Implemented interaction model

- Header: click-driven mobile disclosure; desktop navigation remains direct links.
- Hero: time-driven rotation every 7 seconds when multiple items are available, with click-driven dot controls.
- Cards: hover/focus-driven overlay, image scale and accent title color.
- Search: native form submission to `/search`.
- Playback: click-driven informational dialog; no media request is made.
- Reduced motion: rotation and transitions are disabled or minimized.
