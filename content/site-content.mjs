// New public content for the CMS seed (scripts/seed-content.mjs). Written in the safe Markdown subset (docs/CMS.md).
// Rules: describe only what the code does (values below were checked against php/private/src on 25 Oct 2026); no invented
// numbers, partners, testimonials or live data; anything illustrative says so; official sources for rules that vary.

export const settings = () => ({
  tagline: 'Your journey, in view',
  socialImage: '',
  footerBlurb: FOOTER_BLURB,
  footerNote: FOOTER_NOTE,
});

import { HEADER_LINKS, FOOTER_GROUPS, FOOTER_BLURB, FOOTER_NOTE } from '../src/siteNav.ts';

// The CMS keeps only label and href; appHref belongs to the app.
const strip = (l) => ({ label: l.label, href: l.href });
export const navigation = { header: HEADER_LINKS.map(strip), footer: FOOTER_GROUPS.map((g) => ({ title: g.title, links: g.links.map(strip) })) };

export const pages = {
  home: {
    slug: 'home', kind: 'home', title: 'Flightdeck: flight status, gates and baggage on one page',
    description: 'Look up a flight by number and date to see its status, times, terminal, gate and baggage belt when reported, and where the aircraft is when it is transmitting. Free, with honest labels.',
    body: '',
    hero: {
      eyebrow: 'Your journey, in view',
      title: 'Your flight, clearly, on one page.',
      text: 'Type a flight number and date. Flightdeck brings together the schedule, gate and baggage belt when they are reported, and the aircraft\'s position when it is transmitting, and tells you plainly when something is not known yet.',
    },
    points: ['Scheduled, estimated and actual times, each clearly labelled', 'Gate, terminal and baggage belt as soon as they are reported', 'Never a guessed gate or a made-up position'],
    steps: [
      { title: 'Enter a flight', text: 'A flight number like BA117 and the departure date. Dates from yesterday to three days ahead get the full schedule.' },
      { title: 'We ask the sources', text: 'Schedules and gates from AeroDataBox, live position from the OpenSky Network, and the usual route from adsbdb when no schedule is published yet.' },
      { title: 'You see what is known', text: 'Every time says whether it is scheduled, estimated or actual, in the airport\'s own time zone. Anything we work out ourselves is labelled as an estimate.' },
    ],
    features: [
      { title: 'Status and times', text: 'Departure and arrival times as the airline reports them, with delays worked out from the reported times only.' },
      { title: 'Terminal, gate and baggage belt', text: 'Shown the moment they are reported. Until then the page says "not reported yet" rather than guessing.' },
      { title: 'Where the aircraft is', text: 'Position, height and speed when the aircraft is transmitting and within range of OpenSky receivers.' },
      { title: 'Weather where you land', text: 'Current conditions around the destination airport from Open-Meteo. It is today\'s weather, not a forecast for your arrival.' },
      { title: 'Save, share, add to calendar', text: 'Keep up to 12 flights on your account, share a link to a flight, and add it to your calendar when both times are known.' },
      { title: 'A packing list you can reuse', text: 'Tick items off on your phone, add your own, and keep a list for each trip. There is also a free printable version.' },
    ],
    coverage: {
      title: 'Honest about the data',
      text: 'Flight data is never complete. This is what Flightdeck can and cannot tell you.',
      columns: [
        { title: 'What is covered', items: ['Scheduled flights worldwide that AeroDataBox lists', 'Full details for departures from yesterday to three days ahead', 'Live position for aircraft in range of OpenSky receivers'] },
        { title: 'How fresh it is', items: ['Schedules and gates: refreshed at most every 10 minutes', 'Aircraft position: refreshed every 2 minutes', 'Every result shows when it was fetched'] },
        { title: 'What is often missing', items: ['Gates and belts, which airports often assign late', 'Position over oceans and remote areas', 'Schedules when the shared monthly allowance runs out'] },
      ],
    },
    final: { title: 'Ready when you are', text: 'Create a free account to look up flights, save them and keep your packing list. The guides and the printable packing list need no account.' },
  },

  'how-it-works': {
    slug: 'how-it-works', kind: 'page', title: 'How Flightdeck works', description: 'From typing a flight number to the answer on your screen: where each detail comes from, how fresh it is, and what we never guess.',
    body: `## 1. You enter a flight and a date

Type the flight number as it appears on your booking, such as **BA117** or **EK2**, and the date the flight leaves, in the departure airport's own time. You need a free account to look flights up: each lookup uses a limited allowance from our data providers, and accounts keep that allowance for real travellers.

## 2. We ask up to three sources

- **AeroDataBox** gives the schedule: times, terminal, gate, baggage belt, aircraft type and status. It is asked only for flights leaving from yesterday to three days ahead.
- **The OpenSky Network** gives the live position, height and speed of aircraft that are in the air and transmitting.
- **adsbdb** gives the usual route for a flight number. We use it only when there is no published schedule for your date, and we say so.

Each source can fail on its own. When one does, the page tells you which details are missing and why, and shows the rest.

## 3. We label everything

- Times are **scheduled** (the plan), **estimated** (the current prediction) or **actual** (what happened), shown in each airport's own time zone, so clock changes are handled for you.
- **Progress** and **estimated arrival** are worked out by Flightdeck from the reported times or the aircraft's position. They are always labelled as estimates.
- A usual terminal (for example British Airways at Heathrow Terminal 5) is shown only when nothing is reported, and it says "usual, not confirmed".

## 4. You keep what matters

Save a flight to your account, share a link to it, or add it to your calendar. If you lose signal at the airport, the last result stays on screen with the time it was fetched. It is never shown as live.

## What Flightdeck never does

- It never guesses a gate, belt or boarding time.
- It never shows a stored result as live.
- It never uses an AI model to produce flight facts.

Read more in [Data and coverage](/coverage/) or the guide [What flight tracking can and cannot tell you](/guides/what-flight-tracking-can-and-cannot-tell-you/).`,
  },

  coverage: {
    slug: 'coverage', kind: 'page', title: 'Data, coverage and limits', description: 'Where Flightdeck\'s flight data comes from, how fresh it is, what it does not cover, and the credit each source is owed.',
    body: `## Sources

| Source | What it provides | How fresh |
| --- | --- | --- |
| [AeroDataBox](https://aerodatabox.com/) | Schedule, estimated and actual times, terminal, gate, baggage belt, aircraft type, status | Fetched again at most every 10 minutes per flight |
| [The OpenSky Network](https://opensky-network.org/) | Live position, height, speed and heading of aircraft in the air | One shared snapshot, refreshed every 2 minutes |
| [adsbdb](https://www.adsbdb.com/) | The usual origin and destination for a flight number | Kept for up to 1 hour |
| [Open-Meteo](https://open-meteo.com/) | Current weather around the destination airport | Kept for up to 10 minutes |

Every result shows the time it was fetched.

## Which flights and dates

- Full details are available for flights leaving from **yesterday to three days ahead**. Further ahead, Flightdeck can usually show only the flight's usual route.
- Live position appears only while the aircraft is airborne, transmitting and within range of OpenSky receivers. Over oceans and remote areas there is often no position.
- An aircraft on the ground is never shown as the position of your flight.

## Known limits

- **Gates and baggage belts** are often assigned late by airports and airlines, and some are never published. Until they are reported, Flightdeck says so.
- **Monthly allowance.** Flightdeck uses free plans from its providers for personal, non-commercial use. Schedule lookups share a monthly allowance. If it runs out, schedules pause until the next month and the page tells you; live position and usual routes keep working.
- **Codeshares.** Look up the flight number of the operating airline if a codeshare number is not found.
- **Delays** are worked out only from reported times. Flightdeck does not predict delays.

## Attribution

Flight schedules and status: AeroDataBox. Aircraft positions: The OpenSky Network. Usual routes: adsbdb. Weather: Open-Meteo. Each belongs to its provider and is used under that provider's terms.

If something looks wrong, please [tell us](/contact/).`,
  },

  help: {
    slug: 'help', kind: 'help', title: 'Help and FAQ', description: 'Answers to common questions about looking up flights, accounts, saved flights, the packing list and your data.',
    body: 'Can\'t find your answer? [Contact us](/contact/) and we will reply by email.',
  },

  accessibility: {
    slug: 'accessibility', kind: 'page', title: 'Accessibility', description: 'How Flightdeck aims to be usable by everyone, what we have checked, known issues, and how to tell us about a problem.',
    body: `Flightdeck aims to be usable by as many people as possible. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. This is a target we test against, not a certified result.

## What we have done

- Text can be resized and the pages reflow at phone width without sideways scrolling.
- Every page has a skip link, landmarks and one main heading. The site and app can be used with a keyboard, with a visible focus ring.
- Status is always written as text, never shown by colour alone.
- Animation is reduced or switched off when your device asks for reduced motion.
- No text is smaller than 12.5px, and form fields are large enough to avoid zooming on phones.

## Known issues

- We have not yet completed a full test with screen readers on every device.
- The sign-in window is provided by Clerk, our sign-in service, and its accessibility is outside our direct control.
- Some data, such as aircraft position, is only available as text and numbers, not as a map.

## Tell us about a problem

If something on Flightdeck is hard to use, please [contact us](/contact/). Tell us the page and what happened, and we will try to fix it or give you the information another way.

This statement was last reviewed on {{lastReviewed}}.`,
  },
};

// Changes to converted pages (merged over the converted fields).
export const overrides = {
  'travel-checklist': {
    body: 'A free printable packing list built from a real paper list. Print it, or keep a reusable copy in Flightdeck where your ticks and your own items are saved for every trip.',
  },
  guides: {
    slug: 'guides', kind: 'index', title: 'Travel guides', description: 'Plain, practical guides for the days around a flight: reading flight status, delays, packing and baggage.',
    body: 'Short guides, written in plain English and checked against what airlines and airports actually publish. None of them is legal advice, and where rules matter we link to the official source.',
  },
};

export const faqs = [
  { id: 'free', category: 'Using Flightdeck', question: 'Is Flightdeck free?', answer: 'Yes. Flightdeck is a free, personal, non-commercial project. There are no adverts and nothing to buy.' },
  { id: 'account', category: 'Using Flightdeck', question: 'Why do I need an account to look up a flight?', answer: 'Each lookup uses a limited allowance from our data providers. Accounts keep that allowance for real travellers. The guides and the printable packing list need no account.' },
  { id: 'number', category: 'Using Flightdeck', question: 'Which flight number should I enter?', answer: 'The one on your booking, such as **BA117**. If it is a codeshare and nothing is found, try the operating airline\'s number, which is usually shown on the booking as "operated by".' },
  { id: 'dates', category: 'Using Flightdeck', question: 'Why can I only see the usual route for my flight?', answer: 'Full schedules are available for flights leaving from yesterday to three days ahead. For other dates Flightdeck shows the usual origin and destination, and the times appear closer to departure.' },
  { id: 'gate', category: 'Flight data', question: 'Why is there no gate or baggage belt?', answer: 'Airports often assign gates and belts late, and some never publish them. Flightdeck shows them as soon as they are reported and never guesses. Always follow the screens at the airport.' },
  { id: 'position', category: 'Flight data', question: 'Why is there no live position?', answer: 'Position comes from the OpenSky Network and is only available while the aircraft is airborne, transmitting and within range of its receivers. Over oceans there is often no position.' },
  { id: 'fresh', category: 'Flight data', question: 'How up to date is the information?', answer: 'Schedules and gates are fetched again at most every 10 minutes, and aircraft positions every 2 minutes. Every result shows when it was fetched. See [Data and coverage](/coverage/).' },
  { id: 'offline', category: 'Flight data', question: 'What happens if I lose signal?', answer: 'The last result for that flight stays on screen with "last fetched at" and the time. It is never shown as live.' },
  { id: 'saved', category: 'Your account and data', question: 'Where are my saved flights kept?', answer: 'On your Flightdeck account, so they follow you to other devices (up to 12). Signed-out lists stay on the device you are using.' },
  { id: 'delete', category: 'Your account and data', question: 'How do I delete my account?', answer: 'Use the account menu in the app to delete your account, or [contact us](/contact/) and we will do it for you. See the [privacy policy](/privacy/) for what is kept and for how long.' },
  { id: 'install', category: 'Your account and data', question: 'Can I install Flightdeck on my phone?', answer: 'Yes. Flightdeck works as an installable web app. Open it in your browser and use "Add to Home Screen" (iPhone) or "Install app" (Android and desktop Chrome or Edge). The app shows the steps for your browser.' },
];
