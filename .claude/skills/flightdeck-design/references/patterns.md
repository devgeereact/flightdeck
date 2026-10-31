# Patterns, states and copy

## Composition

- **Rows:** equal columns and equal heights (`align-items: stretch`, card content as a flex column with the action pinned to the bottom). If a group of N cards doesn't fill rows of three, either add a genuine action tile (`.cards-fill`) or choose a layout that divides evenly. Never stretch the last cards wider.
- **Panels:** white, radius 20, header row (`h2` + muted line, actions right), hairline separators instead of nested cards.
- **Forms:** label above value inside one bordered box (`.field`) for search-style inputs; plain labelled inputs with help text and a character count (nowrap) for editors. Errors under the field; focus the first invalid one on submit.
- **Editors/settings:** form left, sticky 340px aside right (Publishing, Visibility, History). Discard disabled until something changes; the header badge mirrors the Publishing badge (Published ↔ Unsaved changes).
- **Approval:** destructive or publishing actions confirm in a dialog that names what will change ("2 questions go live: …").
- **Workflow:** draft (autosaved) → preview (real renderer) → approve (dialog) → publish (history + audit).

## States every flow covers

| State | Treatment |
|---|---|
| Loading | Skeleton or `role="status"` text; reserve space (no layout shift) |
| Empty | Icon tile, what this is, the one next action ("Look up a flight") |
| Validation | Field-level message under the field, from the server where possible |
| Failure | What went wrong, how to fix it, Retry |
| Success | Toast or inline status; undo for removals |
| Permission denied | Owner area: say who can see it, offer the way back |
| Offline / stale | Keep the last result with "last fetched at" and the time; never shown as live |
| Unavailable | Branded 503 ("Back soon" for maintenance) with the app link |
| 404 | Branded page with useful links |

## Data honesty vocabulary

- "Not reported yet" for gates, belts, actual times; "Estimated" labelled; "Usual route only" when no schedule; "Illustrative route, not live tracking" on the arc; "While transmitting" for position; "Today's weather, not a forecast for your arrival".
- Sources named where data appears (AeroDataBox, OpenSky Network, adsbdb, Open-Meteo).
- Sample data in presentations is labelled as sample data.

## Copy

- UK English, plain and specific; sentence case for headings and buttons.
- Buttons are verbs that describe the result: "Save and publish", "Print preview", "Untick this section".
- Errors: cause + fix ("Use the airline code and number, such as BA117.").
- Avoid: marketing filler, invented statistics or testimonials, "seamless/unlock/elevate", "Less X. More Y.", em-dash asides, scare quotes, emoji.

## Motion

- What may move: headline line reveal, search card rise, plane along its dotted arc, slight photo parallax, steps progress line, route/arcs drawing once, list items rising on view change, Flip when a card is removed, counters/rings tweening to value.
- Always: from a visible resting state, interruptible, transform/opacity only, off under reduced motion.

## Anti-patterns (seen and removed before)

Purple-to-blue gradients, glass everywhere, identical rounded cards in endless grids, "01 /" counters, centred everything, decorative blobs, translucent white text on blue, orphan cards, half-empty forms, fake live flights on marketing pages, Clerk `.cl-*` selectors, hard-coded hex in components.
