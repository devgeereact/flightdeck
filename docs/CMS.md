# Flightdeck CMS (owner console)

Status: IMPLEMENTED and tested locally, 25 October 2026. NOT released. Decisions: ADR-015 (site at `/`, app at `/app/`), ADR-016 (file-based CMS), ADR-017 (safe Markdown).

## Who can use it

Only the owner. Every `/api/admin/*` request needs a verified Clerk session token (RS256 against the instance's public keys, issuer, expiry) **and** a user id listed in the private server config `admin_user_ids`. Anyone else gets 401 (not signed in) or 403 (signed in, not the owner). Roles cannot be changed from the browser. There is no editor role (owner decision, 25 Oct 2026).

Open it from the app: sign in at `/app/`, then **Owner console** in the menu (`/app/#/admin`). Sections have their own addresses, for example `/app/#/admin/pages/about`.

## What it manages

| Section | What | Where it shows |
|---|---|---|
| Pages | Home (structured: hero, points, three steps, features, data columns, closing), how it works, coverage, help intro, about, contact intro, privacy, cookies, terms, accessibility, guides index intro, packing list intro, and any new pages | Public website |
| Guides | Travel guides: title, description, section, key points, text, review date | `/guides/…` |
| Help and FAQ | Question, answer, section, order. Reorder with the up/down arrows in the list (saved as drafts, then **Publish changes**). The first four by order also show on the home page | `/help/`, home |
| Announcements | One-line message, info or warning, website / app / both, optional start and end time, optional link | Top of the site and/or the app |
| Menus | Website top menu (1-7 links) and footer groups (1-5 groups of 1-8 links) | Public website |
| Site settings | Site name, tagline, owner name, public contact email, site-wide review date, footer text and note, link-preview image | Everywhere these appear, including the legal pages |
| Enquiries and feedback | Read, reply by email, private note, resolve, archive | Owner only |
| Operations | Overview, usage, costs and limits, provider health (last success and failure per provider, cache, allowance) | Owner only |
| People | Users (Clerk), Google Analytics | Owner only |
| System and audit | What is switched on; every console change | Owner only |

Not editable in the console (on purpose): the site address, provider keys, Clerk settings, ads, rate limits, owner ids. These live only in the private server config and are never sent to the browser. The packing-list items come from the app's own template (`src/features/checklist/checklistTemplate.ts`) so the app and printable list never differ.

## Workflow

1. **Edit** a page or item. **Save draft** stores it privately; the public site does not change.
2. **Preview** renders the draft with the real site renderer in a sandboxed frame (no scripts, nothing saved).
3. **Publish** makes it live on the next request. Published pages are revalidated by browsers and Cloudflare (ETag, `no-cache`); announcements re-check their time window at least every five minutes.
4. **History** lists every save, publish, hide, delete and restore. **Restore to draft** copies an old version into the draft; it goes live only when you publish it.
5. **Hide from site** takes a page, guide, FAQ or announcement off the site without losing it. **Delete** removes it from the site; its history is kept, so it can be restored. Required pages (home, privacy, cookies, terms, contact, help, about, guides index, packing list) can be edited but not hidden or deleted.
6. If you edit in two tabs, the second save is refused ("changed somewhere else"): reload, then edit again.

Existing page addresses cannot be changed (links and search results point at them). New pages get an address when created: `my-page` or `guides/my-guide` (lower case, numbers, hyphens). Reserved names such as `app`, `api`, `assets`, `media` are refused.

## Formatting (safe Markdown)

`## Heading`, `### Smaller`, `#### Smallest` · paragraphs separated by a blank line · `- item`, `1. item` · `**bold**`, `*italic*`, `` `code` `` · `[text](/path/)`, `[text](https://…)`, `[text](mailto:…)` · tables (`| A | B |` then `| --- | --- |`) · `> note`.

Settings placeholders: `{{ownerName}}`, `{{contactEmail}}`, `{{lastReviewed}}`, `{{siteUrl}}`, `{{siteName}}`. `[Cookie settings](#cookie-settings)` reopens the cookie choice.

No HTML. Anything else, including `<script>`, `<iframe>`, `onerror=` and `javascript:` links, is shown as plain text or dropped. The renderer (`php/private/src/Content/Markdown.php`) escapes all input first and can only produce h2-h4, p, ul, ol, li, strong, em, code, a, blockquote and tables. Links must be a site path, `#anchor`, http(s) or mailto; external links get `rel="noopener"`. Placeholder values are escaped, so a setting cannot add formatting or links.

## Branding images

Upload a PNG, JPEG or WebP (600 × 315 to 4000 × 4000 px, up to 2 MB; 1200 × 630 is best) under Site settings. The server decodes and re-encodes it with GD, which removes metadata and anything hidden in the file, and stores it privately under its SHA-256. It is served at `/media/<hash>.<ext>` with a one-year immutable cache. SVG is refused. Without GD on the server, uploads are switched off and the console says so. **The live server's GD support is not yet confirmed** (release checklist).

## Storage and recovery

Files in the private folder (never in the public root), no database:

```
~/flightdeck-private/var/content/published.json            live snapshot (replaced atomically)
~/flightdeck-private/var/content/drafts/<type>/<id>.json   drafts
~/flightdeck-private/var/content/revisions/<type>/<id>/    immutable history (one file per change)
~/flightdeck-private/var/content/media/                    uploaded images
~/flightdeck-private/var/health/providers.json             provider health
~/flightdeck-private/var/admin-audit.log                   audit log (time, 10-character account fingerprint, action)
```

Until the first publish there is no `published.json`, and the site shows the built-in seed (`php/private/src/Content/seed.json`, generated by `node scripts/seed-content.mjs` from `content/pages.mjs`, `content/site-content.mjs`, `src/siteNav.ts` and the packing-list template). If `published.json` is unreadable the site falls back to the seed and logs it.

- **Undo a content change:** open the item, History, Restore to draft, Publish.
- **Undo everything:** move `var/content/published.json` aside; the site shows the seed. Drafts and history stay.
- **Lost files:** restore `var/` from the nightly backup (RUNBOOK). Confirm that the backup includes `var/content` (release checklist).

## API (owner only, under `/api/admin`)

`GET content/<type>` · `POST content/faq-order {ids}` · `GET|PUT|POST|DELETE content/<type>/<id>` (`PUT {baseRev, data}`, `POST {action: publish|unpublish|republish|discard|restore, revision?}`, `GET ?revision=<name>`) · `POST preview {type, id, data}` · `GET|POST media` (raw image body) · `GET health` · `GET audit` · `PATCH enquiries/<id> {status?, note?}` (status adds `resolved`). Types: `page`, `faq`, `announcement`, `navigation` (id `main`), `settings` (id `site`). Public: `GET /api/site` (app announcements, published FAQ, footer links, public settings only). Details in API.md.

## Tests

`pnpm test` (includes `test/site.test.mjs` and the end-to-end `test/cms-http.test.mjs`), `pnpm test:php` (renderer XSS cases, media, health, enquiry notes), `pnpm test:console` (the real console in jsdom against a throwaway server), `scripts/check-apache-routes.sh` (routing under Apache). See TESTING.md.
