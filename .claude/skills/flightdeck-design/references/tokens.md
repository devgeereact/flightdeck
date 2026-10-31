# Tokens

Source of truth: `src/styles/tokens.css` (read it — values below can drift). Older names (`--fd-brand`, `--fd-accent`, `--fd-board`…) are kept and remapped so legacy rules follow the palette; prefer the explicit names for new work.

## Colour

| Token | Value | Use | Measured |
|---|---|---|---|
| `--fd-blue` | #1866ff | Primary action, active nav, links on white, chart series 1 | 4.79:1 on white |
| `--fd-blue-600` / `--fd-link` | #1458e0 | Hover; links and blue text on the canvas | 6.0:1 on canvas |
| `--fd-blue-700` | #0f4fd1 | Text on blue-50 | |
| `--fd-blue-50` / `-100` | #eef4ff / #dde8ff | Tints, selected rows, info notes | |
| `--fd-amber` | #ffb618 | Fill only (kicker rule, avatar, destination dot) | ink on it 10.2:1 |
| `--fd-amber-50` / `--fd-amber-ink` | #fff4db / #8a5300 | Warning badge "Not reported yet" | 4.96:1 |
| `--fd-violet` / `-50` / `-ink` | #8818ff / #f3e8ff / #6a0fd1 | Small badges only ("Draft only", "Owner console") | never a chart colour |
| `--fd-series-2` | #d97706 | Chart series 2 | ΔE 33 protan vs blue |
| `--fd-bg` | #eef1f6 | Page canvas | |
| `--fd-surface` / `-raised` | #fff / #f6f8fb | Panels / chips, table headers | |
| `--fd-heading` | #14171f | Headings, primary text | |
| `--fd-ink` | #2f3644 | Body text | |
| `--fd-muted` | #5e6675 | Secondary text | 5.78:1 white, 5.11:1 canvas |
| `--fd-faint` | #9aa2b1 | Placeholders, decoration only | not for text |
| `--fd-line` / `-strong` | #e3e7ee / #d3d9e3 | Hairlines / control borders | |
| `--fd-ok-ink` / `-bg` | #137a38 / #e8f6ec | Success | 4.87:1 |
| `--fd-danger` / `-bg` | #c0392b / #fdecea | Errors, destructive | |

Status colours always come with a label or icon, never colour alone.

## Type

- `--fd-font-body`: Inter (self-hosted, `public/fonts`, OFL). `--fd-font-head`: Inter Tight.
- Scale: hero clamp(42px, 6.4vw, 84px) · h1 ~46 · h2 ~30 · h3 20 · body 16 (console 15) · small 14 · label 12.5–13 uppercase 600 tracking .06em.
- `.fd-data` / `.num`: tabular figures for times, codes, counts.
- Headings `text-wrap: balance`; body measure ~65 characters.

## Shape and depth

- Radius: `--fd-radius-sm` 10 · `-md` 14 · `-lg` 20 · `-xl` 28 · `-pill` 999.
- Shadow: `--fd-shadow-1` sheet · `-2` control · `-3` card/search · `-4` dialog/menu · `--fd-shadow-blue` primary button.

## Space and size

- Scale `--fd-space-1..9`: 4, 8, 12, 16, 24, 32, 48, 72, 120 (8-point grid, 4 for fine detail).
- Page width `--fd-page-w` 1360 (site 1600 above 2200px); app view 1480 (1680 above 2200px); reading width 760.
- Gutter clamp(12px, 2.4vw, 28px). Tap target `--fd-tap` 44px.

## Motion

- `--fd-ease` cubic-bezier(.22, 1, .36, 1), `--fd-dur` .22s (0 under reduced motion).
- Entrances 400–900ms via GSAP; micro-interactions 150–300ms; exits faster than entrances.
