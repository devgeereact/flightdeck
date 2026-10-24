# Flightdeck decision records

## ADR-001: preserve current prototype
24 October 2026 · accepted for docs task. Keep React/TypeScript/Express working code unchanged. The new cPanel PHP stack is a target preference, not retrospective proof of implementation. Consequence: PHP parity/migration remains a separate approved code task.

## ADR-002: guest/browser-local V1
Current implementation has no accounts/DB. Treat Clerk/MariaDB as conditional; do not add services solely to match a template. Revisit only if cross-device/persistent shared requirements are accepted.

## ADR-003: honest data provenance
Samples must stay labelled. No guessed boarding/gates/baggage/location. No authorised live flight source currently exists. A schematic is never geographic tracking evidence.

## ADR-004: deliberate releases
Respect the user's limited Actions budget: production-branch/manual deployment is preferred. No repo/workflow exists yet, and documentation does not create one or authorise deployment.

## ADR-005: source backup without Git
Flightdeck has no .git/remote. Approved verified source archive substitutes for bundle for this task; Git history/branches cannot be audited or cleaned. Do not initialise/push as a side effect of docs creation.
