# Flightdeck data model

Reviewed 25 October 2026. There is no SQL database. Shared data is JSON files in the private folder (`~/flightdeck-private/var`, mode 600), written with a lock, a unique temp file and a rename. A database is not needed at this size (ADR-016); MariaDB stays the option if that changes.

## Server files (`var/`)

| Path | Contents | Kept | Written by |
|---|---|---|---|
| `cache/*.json` | Provider answers, Clerk keys, allowance counters, rate state (`{expires, data}`) | Until expiry, swept | Store |
| `rate/` | Per-visitor request counters | Minutes | Store |
| `metrics/YYYY-MM-DD.json` | Daily anonymous counters, top-N maps, salted user-id hashes for distinct counts (compacted after 2 days) | 400 days | Metrics |
| `checklists/<hash>.json` | One packing-list document per signed-in user, with `rev` | Until the user deletes it | Checklists |
| `enquiries/<id>.json` | Message, kind, status (new/read/replied/**resolved**/archived), name, email, replies, **note**, **resolvedAt** | Until deleted on request | Enquiries |
| `content/published.json` | Live CMS snapshot: `settings`, `navigation`, `guideCategories`, `pages{slug:…}`, `faqs[]`, `announcements[]`, `publishedAt` | Replaced on publish | ContentStore |
| `content/drafts/<type>/<id>.json` | `{type, id, rev, updatedAt, updatedBy, data}` (`/` in ids stored as `~`) | Until published or discarded | ContentStore |
| `content/revisions/<type>/<id>/<UTC μs>-<rand>.json` | `{type, id, action, at, by, data}`, immutable | Kept (small) | ContentStore |
| `content/media/<sha256>.<png|jpg|webp>` | Re-encoded branding images | Kept | Media |
| `health/providers.json` | Per provider: lastOk, lastFail, lastFailCategory, consecutiveFailures | Overwritten | Health |
| `admin-audit.log` | `<ISO time> <10-char sha256 of the user id> <action>` | Grows; no rotation yet | Admin |

`by` and `updatedBy` hold the same 10-character fingerprint as the audit log, never the Clerk user id.

## CMS item shapes (validated by `Content/Validator.php`)

- **page**: `slug` (fixed once created), `kind` (home, page, about, legal, guide, help, contact, checklist, index), `title` 3-120, `description` 20-300, `body` (safe Markdown, up to 60,000), optional `lastReviewed` (YYYY-MM-DD), `unpublished`. Guide: `category`, `takeaways` (up to 5). Home: `hero{eyebrow,title,text}`, `points[]`, `steps[3]{title,text}`, `features[1-9]`, `coverage{title,text,columns[≤4]{title,items[≤6]}}`, `final{title,text}`.
- **faq**: `id`, `question` 5-200, `answer` (Markdown) 5-4000, `category`, `order`, `unpublished`.
- **announcement**: `id`, `message` 3-280 (plain), `level` info|warning, `where` site|app|both, `start`/`end` (ISO UTC or empty, end after start), `linkLabel`, `linkHref` (safe link), `unpublished`.
- **navigation** (`main`): `header[1-7]{label,href}`, `footer[1-5]{title, links[1-8]}`.
- **settings** (`site`): `siteName`, `siteUrl` (fixed), `ownerName`, `contactEmail` (valid), `lastReviewed`, `tagline`, `footerBlurb`, `footerNote`, `socialImage` (`/media/<sha256>.<ext>` or empty).

## Browser storage (per device)

`flightdeck-saved` (+ `flightdeck-saved-owner`), `flightdeck-checklist`, `flightdeck-last-results` (6), `flightdeck-public-packing`, `flightdeck-dismissed` (dismissed app announcements, 20), `fd-consent`. All listed on the cookies page. Signed-in saved flights also live in the user's Clerk profile (`unsafeMetadata.savedFlights`, up to 12).

## Migrations

None needed: new folders are created on first write. Until the first publish the site reads the seed. Rolling back the code leaves `var/content` unused and harmless.
