# Forumo Design System

Warm editorial marketplace — cream background, ink type, terracotta accent. Light-only; the `.dark` class is present for shadcn compatibility but the app never enables it.

---

## Identity

| Property           | Value                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| **Character**      | Warm, editorial, trustworthy. Physical-goods marketplace with a print-press feel. |
| **Mode**           | Light only                                                                        |
| **Base font size** | 15px                                                                              |

---

## Colour Tokens

All colours are defined as CSS custom properties on `:root` and as `--color-forumo-*` entries in the Tailwind `@theme` block (in `apps/web/src/app/globals.css`). Use the CSS variable form in component CSS; use `text-forumo-*` / `bg-forumo-*` utilities in Tailwind class strings.

### Core surfaces

| Token         | Value                                | Use                                         |
| ------------- | ------------------------------------ | ------------------------------------------- |
| `--bg`        | `oklch(0.972 0.012 80)` — warm cream | Page background                             |
| `--surface`   | `oklch(1 0 0)` — white               | Cards, modals, inputs                       |
| `--surface-2` | `oklch(0.955 0.014 80)` — off-white  | Hover states, code blocks, secondary panels |

### Type / ink

| Token     | Value                               | Use                                |
| --------- | ----------------------------------- | ---------------------------------- |
| `--ink`   | `oklch(0.20 0.012 50)` — near-black | Body text, headings                |
| `--ink-2` | `oklch(0.38 0.012 50)`              | Labels, secondary text (`.subtle`) |
| `--ink-3` | `oklch(0.55 0.010 50)`              | Placeholder, metadata (`.muted`)   |

### Borders / lines

| Token      | Use                                      |
| ---------- | ---------------------------------------- |
| `--line`   | Default border — card outlines, dividers |
| `--line-2` | Stronger border — input resting state    |

### Brand accent (terracotta / gold)

| Token         | Value                                    | Use                          |
| ------------- | ---------------------------------------- | ---------------------------- |
| `--accent`    | `oklch(0.97 0 0)` (shadcn compat alias)  | —                            |
| `--accent-2`  | `oklch(0.50 0.140 40)` — deep terracotta | Button hover, active states  |
| `--accent-bg` | `oklch(0.94 0.040 50)` — warm tint       | Pill backgrounds, alert-info |

> **Note:** `.btn-primary` uses `var(--accent)` for background. In the current token set `--accent` resolves to near-white (shadcn compat), so `--color-forumo-gold` (`oklch(0.58 0.140 40)`) is the true brand terracotta for decorative use. Buttons that need the terracotta read `var(--accent-2)` on hover.

### Escrow (green trust signal)

| Token         | Value                                      | Use                                               |
| ------------- | ------------------------------------------ | ------------------------------------------------- |
| `--escrow`    | `oklch(0.50 0.070 155)` — muted teal-green | Payment confirmed, verified badge, success states |
| `--escrow-bg` | `oklch(0.94 0.035 155)`                    | `.pill-escrow`, `.alert-success` backgrounds      |

### Warning / amber

| Token       | Value                               | Use                                     |
| ----------- | ----------------------------------- | --------------------------------------- |
| `--warn`    | `oklch(0.65 0.140 75)` — warm amber | Pending states                          |
| `--warn-bg` | `oklch(0.95 0.050 80)`              | `.pill-warn`, `.alert-warn` backgrounds |

### Destructive

Use `oklch(0.577 0.245 27.325)` (same as `--destructive` shadcn token) for delete actions, error text, invalid borders.

### Focus ring

`--ring-accent: oklch(0.65 0.140 40 / 0.35)` — accent-tinted, 3px spread. Applied via `box-shadow: 0 0 0 3px var(--ring-accent)` on `:focus-visible` for all interactive controls.

---

## Typography

Three font families loaded from Google Fonts.

| Role      | Family         | CSS var   | Use                                                    |
| --------- | -------------- | --------- | ------------------------------------------------------ |
| **Sans**  | Geist          | `--sans`  | UI, body copy, buttons, labels                         |
| **Serif** | Newsreader     | `--serif` | Display headings, price figures, editorial pull-quotes |
| **Mono**  | JetBrains Mono | `--mono`  | Prices, codes, eyebrow labels, `.pill` values          |

### Scale classes

| Class        | Spec                                                              | Use                           |
| ------------ | ----------------------------------------------------------------- | ----------------------------- |
| `.h-display` | Newsreader 400 · `clamp(36px, 5vw, 56px)` · lh 1.05 · ls −0.025em | Hero headings                 |
| `.h1`        | Newsreader 500 · 32px · lh 1.1 · ls −0.02em                       | Page titles                   |
| `.h2`        | Newsreader 500 · 22px · lh 1.2 · ls −0.015em                      | Section headings              |
| `.h3`        | Sans 600 · 15px · ls −0.005em                                     | Card/panel headings           |
| `.eyebrow`   | Mono 11px · uppercase · ls 0.08em · `--ink-3`                     | Section labels, category tags |
| `.muted`     | —                                                                 | `color: var(--ink-3)`         |
| `.subtle`    | —                                                                 | `color: var(--ink-2)`         |
| `.mono`      | —                                                                 | `font-family: var(--mono)`    |

---

## Elevation

Shadows are warm-tinted (ink hue), never pure black.

| Token         | Value                                        | Use                                  |
| ------------- | -------------------------------------------- | ------------------------------------ |
| `--shadow-sm` | `0 1px 2px -1px oklch(0.20 0.012 50 / 0.10)` | Resting cards, buttons               |
| `--shadow`    | `0 4px 12px -4px oklch(… / 0.12)`            | Hovered buttons                      |
| `--shadow-md` | `0 8px 20px -8px oklch(… / 0.16)`            | Hovered cards                        |
| `--shadow-lg` | `0 18px 36px -14px oklch(… / 0.20)`          | Floating panels, `.card-hover:hover` |

---

## Motion

| Token        | Value                               |
| ------------ | ----------------------------------- |
| `--ease`     | `cubic-bezier(0.22, 0.61, 0.36, 1)` |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| `--t-fast`   | 120ms                               |
| `--t`        | 200ms                               |
| `--t-slow`   | 320ms                               |

All transitions use these tokens. A global `@media (prefers-reduced-motion: reduce)` block collapses all durations to 0.01ms and removes hover lifts / escrow pulse.

---

## Border Radius

| Token    | Value |
| -------- | ----- |
| `--r-sm` | 6px   |
| `--r`    | 10px  |
| `--r-lg` | 14px  |
| `--r-xl` | 20px  |

---

## Component Classes

### Buttons

Base: `.btn` — 40px tall, 14px/500, rounded-[10px], all transitions wired.

| Modifier       | Description                         |
| -------------- | ----------------------------------- |
| `.btn-primary` | Terracotta fill, white text         |
| `.btn-ink`     | Near-black fill, cream text         |
| `.btn-ghost`   | Transparent, `--line-2` border      |
| `.btn-soft`    | `--surface-2` fill, `--line` border |
| `.btn-sm`      | 32px / 13px / r-8                   |
| `.btn-lg`      | 48px / 15px / r-12                  |
| `.btn-block`   | `width: 100%`                       |

Legacy alias `.btn-forumo` maps to the same terracotta primary style.

### Cards

| Class          | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| `.card`        | White surface, `--line` border, `--r-lg` radius, `--shadow-sm` |
| `.card-pad`    | 20px padding (scales with `--sp`)                              |
| `.card-hover`  | Adds lift + shadow increase on hover                           |
| `.card-forumo` | Legacy alias — same visuals                                    |

### Pills, chips, badges

| Class             | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| `.pill`           | Neutral chip — `--surface-2` / `--ink-2`                      |
| `.pill-accent`    | Terracotta tint — `--accent-bg`                               |
| `.pill-escrow`    | Green tint — `--escrow-bg`                                    |
| `.pill-warn`      | Amber tint — `--warn-bg`                                      |
| `.chip`           | Larger selectable filter chip (toggle `.active` for ink fill) |
| `.verified-badge` | Inline green badge with icon                                  |

### Forms

Wrap each control in `.field`. Children `input`, `select`, `textarea` get full-width styling, `--accent` focus border, and `--ring-accent` shadow ring. Add `.is-error` or `aria-invalid="true"` for red error state. Use `.field-error` for the error message span.

### Alerts

`.alert` — base surface. Modifier: `.alert-success`, `.alert-error`, `.alert-warn`, `.alert-info`.

### Utility classes

| Class             | Description                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `.skeleton`       | Warm shimmer loading block — replaces `animate-pulse`                                    |
| `.stagger`        | Drop on a grid/list; direct children fade up in sequence (nth-child 1–8, 0–280ms delays) |
| `.fade-up`        | Single `fadeUp` animation (`--t-slow`, `--ease-out`)                                     |
| `.hero-glow`      | Positioned wrapper — soft radial accent/escrow wash behind hero content                  |
| `.scrollbar-none` | Hide scrollbar cross-browser                                                             |
| `.ph`             | Placeholder image — hatched cream pattern                                                |
| `.ph-label`       | Mono label overlay inside `.ph`                                                          |

### Listing card

`.listing-card` — vertical flex, `.ph` image (1:1), `.body` padding, `.price` (mono), `.title` (2-line clamp), `.meta`.

### Escrow timeline

`.escrow-timeline` — 4-column grid with connecting line. Steps: `.escrow-step` + `.escrow-dot`. State modifiers: `.done` (green fill), `.active` (pulsing ring). Progress bar via `--progress` CSS variable on `.escrow-timeline.show-progress`.

### Trust strip

`.trust-strip` — 4-column grid with `--line` gaps. Each cell `.trust-cell` has `.num` (Newsreader 28px) and `.lbl`.

---

## Do's and Don'ts

**Do**

- Use `var(--*)` tokens — never hardcode `oklch(…)` values in component files.
- Reach for `.skeleton` instead of `animate-pulse bg-slate-200`.
- Use `.stagger` on any grid that renders a list of cards.
- Keep all new components in the light theme; the app is light editorial throughout.

**Don't**

- Use `bg-slate-900/950/800`, `border-slate-700/800`, `text-white` as background/border/body colours — these are the old dark template and clash with the layout.
- Use `text-amber-400` or `bg-amber-500` — convert to `var(--accent)` / `.btn-primary`.
- Use stray `violet` accent colours — not part of the brand.
- Add `"use client"` to layout files.
- Hardcode shadow values; use `--shadow-sm` / `--shadow` / `--shadow-md` / `--shadow-lg`.

---

## File Reference

| File                           | Role                                                         |
| ------------------------------ | ------------------------------------------------------------ |
| `apps/web/src/app/globals.css` | Single source of truth for all tokens and utility classes    |
| `packages/design-system/src/`  | Shared React components (Button, Card, DataTable, FilterBar) |
| `packages/shared/src/types.ts` | Zod schemas — data shapes that components consume            |
