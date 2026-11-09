# Flightdeck project memory

Reviewed 8 November 2026. The durable facts and decisions; details live in the linked docs.

## What it is
A personal, free, non-commercial flight tracker (owner decision, 25 Oct 2026) at flightdeck.gakinz.com: public PHP-rendered website at `/`, React PWA at `/app/`, owner console inside the app, PHP API with a file store (no database). Repository `devgeereact/flightdeck` (private), branch `main`; every push to main deploys (30 Oct 2026).

## Decisions that still hold
- PHP is the only backend (24 Oct 2026, ADR-006/007); the Node server is retired (ADR-018, git history).
- Clerk sign-in; flight, weather, travel-guide and web-check look-ups need a signed-in user. Owner = `admin_user_ids` in the server config.
- File-based CMS with drafts, publish, history and audit (ADR-015..017).
- Blue design system, own logo, Inter / Inter Tight (ADR-020, 31 Oct 2026; supersedes the October green and signage styles). Design rules: docs/DESIGN.md and `.claude/skills/flightdeck-design`.
- Honest data: never fabricate flights or operational data. Typical boarding and gate-closing times are allowed only when labelled "Typical" (1 Nov 2026). Web search results are shown as links to check. Since ADR-025 (9 Nov 2026) a gate, terminal, belt or boarding time may also be read from them by Claude, but only after the code has checked the flight number, date, airport and exact wording, and it is always labelled "From the web"; times of departure, arrival, take-off and landing never come from the web.
- Destination content for any city comes from Wikivoyage/Wikipedia (free, CC BY-SA, credited); hand-written guides exist for New York, Dubai and Paris.
- Paid services stay off until the owner adds a key and approves the cost (AeroDataBox is on). Bright Data: the owner chose ON on 8 Nov 2026; it is live only once the key and zone are in the server config (the live site reported `webCheck: false` that day).

## Open for the owner
Console checked live with the production account; a real phone; a real screen reader; a paper print; Firefox (BLOCKED on this Mac); set the Bright Data key and zone in config.php; restrict Clerk sign-up in the Clerk dashboard; hide the host's `X-Turbo-Charged-By` header (Cloudflare rule).

## Risks
Provider coverage (gates and belts often unpublished; no positions over oceans); AeroDataBox free allowance; shared-host limits; backups on the same disk as the site.
