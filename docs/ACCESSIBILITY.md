# Flightdeck accessibility review plan

Target: WCAG 2.2 AA where applicable, not verified certification. Existing semantic labels/focus styles/live region/reduced-motion support are useful starting points, not proof.

Required tests: keyboard search/date/source selection, sample/save/reopen/remove, tab focus order, error announcements, local clocks not excessively announced, screen-reader status/timeline, 200–400% zoom, mobile reflow, long labels and no colour-only delay meaning. Measure contrast for muted green labels and revisit tiny 7–10px copy. Respect reduced motion and accessible touch targets.

No automated accessibility report or manual assistive-technology audit has been executed in this docs pass. Track defects in VERIFICATION and scoped implementation tickets.

## Added 24 Oct 2026
- Checklist ticks are real buttons with labels and keyboard support; suggestions have labelled Add and Dismiss controls.
- Consent banner offers Accept and Reject with equal weight and is reachable from "Cookie settings" in every footer.
- Public pages have a skip link, one h1, landmark nav and footer, and work at phone width without sideways scrolling; print styles hide chrome.
- Not yet audited with a screen reader or an automated tool (axe/Lighthouse). Ad slots, when enabled, must be labelled "Advertisement" and kept off the app and console.
