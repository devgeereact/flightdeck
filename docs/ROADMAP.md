# Flightdeck roadmap

## Done
Foundations, PHP API on cPanel, live data (AeroDataBox, OpenSky, adsbdb), deploy on push over SSH, public website and CMS, blue redesign (ADR-020), gates and key times, destination weather and Discover for any city (ADR-021).

## Next
- Owner checks: console with the production account, a real phone, a screen reader, a paper print, Firefox.
- Bright Data web links: switch on only if the owner wants them (key + zone in config.php; cost per search).
- Push notifications for gate and delay changes (needs a background job; cPanel cron could poll saved flights).
- External uptime monitor with fast alerts.

## Code-quality follow-ups — 28 October 2026 (from the Biome warnings)
Fix in small slices, then raise each rule to "error" in `biome.json`:
1. Buttons without `type` (71) — `type="button"` for actions, `type="submit"` only for form submit buttons.
2. React hook dependencies (29) — review each effect/callback for stale values.
3. `any` (59) and non-null `!` (40) — replace with real types and explicit checks at boundaries.
4. CSS: duplicate properties and shorthand overrides (2), `!important` (39).
5. Other accessibility rules (~20) — fix with keyboard testing.

## AI and automation (moved from AI-AUTOMATION.md, 1 Nov 2026)

No AI model, chat feature, RAG, embeddings, queue, scheduled cron or server webhook is implemented. They are NOT REQUIRED for the core flight summary. The update interval is foreground browser polling; it does not continue as a background flight notification service.

Future automation requires a concrete user need, cost/data/privacy evaluation, idempotency/retry/locking, supported hosting execution surface, failure recovery and approval. Do not add Inngest, Sentry, ImageKit, Neon or Supabase simply because they were mentioned in a reusable prompt. No third-party provider is authorised by this document.

### Status (24 Oct 2026)
- Live, rule-based and deterministic: packing suggestions from direction, international, weather, trip length and nights (src/features/checklist), and the plain-English flight summary (src/features/flight/summary.ts). No AI model is called and no user text leaves our servers for them.
- Phase 8 (Claude-written packing additions, delay summary) is NOT built. Requirements before enabling: server-side only, signed-in users, 10 calls per user per day, 24 h cache, an AI_ENABLED flag, never visa or entry-rule advice (link to GOV.UK), and the privacy notice updated first.
