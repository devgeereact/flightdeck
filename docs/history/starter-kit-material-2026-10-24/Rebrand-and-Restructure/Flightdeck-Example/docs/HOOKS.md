# Flightdeck hooks and event boundaries

## Implemented React effects
App mounts: config fetch, online/offline listeners, beforeinstallprompt capture, local clock interval, initial BA117 sample load. Search uses AbortController and request version to prevent an old search overwriting a new result. Automatic refresh runs every 60 seconds only while enabled/online/page is open. Weather effect aborts when destination changes. Saved searches use localStorage.

These behaviours are currently embedded in src/main.tsx; there is NO separate src/hooks directory or exported hook API yet. Before extraction, define inputs, outputs, state transitions, cancellation and error tests. Potential future hooks: useFlightSearch, useDestinationWeather, useSavedFlights, useLocalClock, usePWAInstall and usePWAUpdate. They are PLANNED, not implemented merely by listing them.

## PWA lifecycle
vite-plugin-pwa registers prompt-mode service worker for production. A complete user-facing update prompt remains a release task. Offline status exists; no background flight watcher, push subscription, cron or server webhook exists.

## Agent/Claude hooks
No project-specific AI lifecycle hooks are installed by this docs task. The user's machine-level Claude transcript archiver is outside this repository and is not application functionality. Never copy its private chat paths/config into deployment.
