# Flightdeck design specification

CURRENT source: src/style.css and src/main.tsx. This is descriptive, not a completed accessibility audit.

## Identity
Flightdeck; “Your journey, in view”. Calm travel dashboard, pale green surfaces and dark green text, light visual density. Clear source/status labels take priority over decorative live-looking indicators.

## Existing visual values
Main background #f6f7f4; dark green around #233c35 and #193f35; brand/manifest #133c35; pale green panels and muted secondary labels. DM Sans for body and Manrope for headings are currently loaded from Google Fonts with system fallbacks. Font delivery/offline/privacy review remains. Styles use plain CSS; do not impose Tailwind during documentation work.

## Components and layout
Desktop sidebar, header/search panel, sample notice, flight/route cards, timeline, arrival/weather panels, update feed and destination cards. Mobile hides the desktop sidebar and offers compact navigation. Breakpoints exist at 1200, 1000 and 700px. Icons use Lucide; route and destination art are code-native SVGs, not live maps/photos.

## Behaviour and accessibility
Maintain labels, visible focus, keyboard access, async error states, polite update announcements and reduced-motion media query. Status needs text, not colour alone. Several labels use 7–10px type and low-contrast muted colours; these require a measured contrast/zoom/readability audit. Do not claim WCAG AA passes. Test compact saved navigation and long airline/airport values.

## PWA and visual QA gaps
Only an SVG icon is configured in Flightdeck; PNG/maskable support remains planned. Service-worker prompt registration exists but a complete in-app release-update prompt is not implemented. Historical desktop/mobile visual inspection occurred on 23 October; no complete screen-reader, install or offline audit is evidenced.

Any future design iteration must cover loading/empty/no-provider/offline/stale/invalid-search states and preserve unmistakable demo labelling.
