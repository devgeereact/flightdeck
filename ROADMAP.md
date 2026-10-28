# Flightdeck roadmap

The canonical roadmap is [docs/ROADMAP.md](docs/ROADMAP.md). Current implementation and target architecture are separated in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Read [docs/VERIFICATION.md](docs/VERIFICATION.md) before claiming completion. The prior roadmap is preserved under docs/history/.

## Code-quality follow-ups — 28 October 2026 (from the Biome warnings)
Fix in small slices, then raise each rule to "error" in `biome.json`:
1. Buttons without `type` (71) — `type="button"` for actions, `type="submit"` only for form submit buttons.
2. React hook dependencies (29) — review each effect/callback for stale values.
3. `any` (59) and non-null `!` (40) — replace with real types and explicit checks at boundaries.
4. CSS: duplicate properties and shorthand overrides (2), `!important` (39).
5. Other accessibility rules (~20) — fix with keyboard testing.
