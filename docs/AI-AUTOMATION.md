# Flightdeck AI and automation

No AI model, chat feature, RAG, embeddings, queue, scheduled cron or server webhook is implemented. They are NOT REQUIRED for the core flight summary. The update interval is foreground browser polling; it does not continue as a background flight notification service.

Future automation requires a concrete user need, cost/data/privacy evaluation, idempotency/retry/locking, supported hosting execution surface, failure recovery and approval. Do not add Inngest, Sentry, ImageKit, Neon or Supabase simply because they were mentioned in a reusable prompt. No third-party provider is authorised by this document.
