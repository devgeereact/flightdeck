# Flightdeck AI and automation

No AI model, chat feature, RAG, embeddings, queue, scheduled cron or server webhook is implemented. They are NOT REQUIRED for the core flight summary. The update interval is foreground browser polling; it does not continue as a background flight notification service.

Future automation requires a concrete user need, cost/data/privacy evaluation, idempotency/retry/locking, supported hosting execution surface, failure recovery and approval. Do not add Inngest, Sentry, ImageKit, Neon or Supabase simply because they were mentioned in a reusable prompt. No third-party provider is authorised by this document.

## Status (24 Oct 2026)
- Live, rule-based and deterministic: packing suggestions from direction, international, weather, trip length and nights (src/checklistRules.ts), and the plain-English flight summary (src/summary.ts). No AI model is called and no user text leaves our servers for them.
- Phase 8 (Claude-written packing additions, delay summary) is NOT built. Requirements before enabling: server-side only, signed-in users, 10 calls per user per day, 24 h cache, an AI_ENABLED flag, never visa or entry-rule advice (link to GOV.UK), and the privacy notice updated first.
