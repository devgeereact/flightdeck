# Overnight build, 25 October 2026

For: the owner's morning review. Everything below was built and tested locally. Commits are pushed to `main` only; nothing was pushed to `production`, so the live site is unchanged until you release.

UK time note: the clocks went back from BST to GMT at 02:00 this morning, so the time work below was tested across that change.

## How the night was run

I set the priorities and split the work between four specialist agents and myself:

| Track | Who | Result |
|---|---|---|
| Content and SEO | content agent (own branch) | 4 new guides (15 in all), breadcrumb structured data, stricter page tests |
| UK time and daylight saving | time agent (own branch) | 6 real bugs fixed, 30+ new time tests |
| Security audit | auditor (read only) | No Critical or High findings; 3 Medium and 8 Low, all actionable ones fixed |
| UX and accessibility audit | auditor (read only) | 20 findings across phone, desktop, consistency and accessibility |
| UX fixes | implementer agent (own branch) | see "UX and accessibility" below |
| Features, merges, verification | me | see below |

## New features

- **Flight links and Share.** Every searched flight gets its own address (`#/flight/BA59/2026-10-25`). Opening it shows that flight straight away. Share uses the phone's share sheet or copies the link.
- **Countdown.** "Leaves in 2 h 15 min", "Due at the gate in 5 h", "Arrived 10 min ago", worked out only from reported times. No time, no label.
- **Add to calendar.** A calendar file written in UTC, so every calendar shows the right local time. Offered only when both departure and arrival times are known.
- **Offline fallback.** If the connection fails, the last result for that flight stays on screen with "You're offline. This is what Flightdeck last fetched at 01:12, 25 Oct". It is never shown as live.
- **Saved flights.** Labelled Today, Tomorrow, Yesterday or the date, using the UK date, with old flights marked Past.
- **Install help.** The browser pop-up is replaced by a clear panel with steps for iPhone, Android, Chrome or Edge, Safari on a Mac and Firefox.

## UK time and daylight saving (fixed)

1. The search window (yesterday to three days ahead) used the UTC date, so near midnight it was a day off. It now accepts any date that is in range somewhere on Earth.
2. Owner console counters used UTC days. Activity between midnight and 1 am in summer landed on the wrong day. They now use UK days, and the 7/30/90-day ranges step back calendar days, so the clock change no longer counts a day twice.
3. The flight summary wrote "London time" even when it had to fall back to UTC. It now says UTC.
4. An unreadable time or time zone could crash the flight view. It now shows "Not available".
5. A malformed trip date could be sent to the server. Trips now keep a flight only with a real calendar date.
6. One summary test could never fail. It now checks what it says.

Display changes:
- The date badge shows the UK date.
- The estimated arrival is in the destination's time, not yours.
- Journey steps show the day, so an overnight landing reads correctly.
- "Fetched" and "Updated" times say which clock they use.

## Security (fixed)

- The contact form and event counter refuse requests from other sites and non-JSON posts.
- Limits count an IPv6 visitor by network.
- At most 20 emails an hour are sent; later messages are still kept for the console.
- At most 5,000 messages are stored.
- The cache now cleans itself.
- Sign-in keeps working on last week's keys if Clerk's key server is down.
- Replies and status changes can no longer overwrite each other.
- The email link in the console is encoded.
- The PHP version is hidden.
- The live CSP no longer allows Clerk's development hosts.

Details: docs/SECURITY.md ("Overnight hardening") and docs/DECISIONS.md ADR-013.

## Content and SEO

New guides:
- How to read an airport departure board
- Connecting flights and what to do if you miss one
- Cabin bag or hold bag: what goes where
- What flight tracking can and cannot tell you

All rules that vary are hedged and point to GOV.UK, the CAA, the airline or the airport. Every guide page now has BreadcrumbList structured data and a matching visible breadcrumb. I deliberately added no FAQ schema: there is no visible Q&A content, and Google limits FAQ results anyway. The cookies page and docs/PRIVACY.md now list the two new things kept on the device.

## UX and accessibility

All 20 audit findings were implemented, then I checked them in Chrome at phone (375px), tablet (800px) and desktop widths.

- **Navigation.**
  - Tablets (701 to 1000px) had no navigation at all. They now get an icon sidebar.
  - On phones the menu is one scrollable row with 44px buttons and the current page highlighted.
- **Flight tabs on phones.** All five fit as a grid with icons, and "Destination" shows as "City" on small screens. The tabs work with the keyboard (arrow keys, Home, End).
- **Flight actions on phones.** They are one tidy group: Save first, then Add to calendar, Share and Refresh, with "Updated" underneath.
- **Inputs.**
  - The search fields show a clear focus ring.
  - Inputs are 16px on phones, so iPhones no longer zoom in.
  - One focus style is used everywhere.
- **Landing page.** It keeps the one-screen look but can scroll if the text is enlarged. The duplicate "Sign in" is hidden on small phones.
- **Packing list on phones.** The header is compact and the suggestions fold away. Previous and Next keep the section chip in view.
- **Owner console.**
  - Charts draw at the real width, with readable axes and the latest value in the header.
  - On phones the tabs scroll and the cards show two per row.
- **Consistency.**
  - One button system (`.btn`, `.btn-primary`, `.btn-secondary`) is used across the app and the public pages.
  - No text is smaller than 12.5px, and body text and notices are 14px.
  - Labels are written in normal case and shown in capitals by CSS, so screen readers read words.
- **Accessibility.**
  - A "Skip to content" link has been added.
  - The navigation marks the current page.
  - The console tabs are proper tabs.
  - The feedback type uses real radio buttons.
  - Touch targets are 44px on touch screens.
  - Smooth scrolling switches off for people who prefer reduced motion.
- **Clean-up.**
  - About 20 dead CSS rules are removed, including the old footer rule that padded the app footer.
  - The copy fixes are in, such as "Costs and limits", "Mark as read" and a link to the privacy page.

## Tests (all run locally on the final code)

| Suite | Result |
|---|---|
| `pnpm build` (types, app, public pages) | passes |
| `pnpm test` (unit and page tests) | 92 of 92 pass (71 before tonight) |
| `pnpm test:ui` (the real built app in a test browser, fixed flight data) | 47 of 47 checks pass (28 before tonight) |
| `php php/tests/run.php` (server) | all pass, including new security and time tests |
| Visual check in Chrome | phone 375px, tablet 800px, desktop 1440px: no sideways overflow, all screens readable |

Not tested: a real phone, a real big monitor, and anything on the live site (by your instruction).

## Decisions I made as lead

- **Push target:** pushes go to `main` only. A push to `production` releases live, and you asked to keep live untouched.
- **Node reference server:** the old Node server is out of date against the PHP API (sign-in, console, enquiries). Production only runs PHP, so its parity script is retired as a release check. The release workflow already ignores it.
- **No FAQ schema:** see above.
- **Weather precision:** weather is looked up per 0.1 degree (about 11 km). That is plenty for airport weather and closes a cache-growth hole.

## What I need from you

1. Review this on your machine (`pnpm dev`), then release with `git push origin main:production` when happy.
2. Server config: confirm `clerk_authorized_parties` is `['https://flightdeck.gakinz.com']`. If not, I can set it once you're back.
3. Still yours from before: the phone check on a real device, the AdSense decisions, an Anthropic key for Claude-written suggestions, and the second admin's Clerk user id.
