# Design Guidelines — "State Papers"

The visual system for Gubernator. The app's world is charters, treasuries, censuses,
and seals, so the UI reads as a **registry/ledger**, not a SaaS dashboard: open
sections divided by rules and typography, dense tabular figures, and enclosure
reserved for the few surfaces that genuinely float above the page.

Source of truth for tokens: `src/index.css`. Source of truth for primitives:
`src/components/ui` and `src/components/shared`. When this document disagrees with
those files, the files win — then fix this document.

## Principles

1. **Rules, not boxes.** Hierarchy comes from hairline rules, alignment, and type —
   never from wrapping content in another bordered rectangle. A page shows at most
   one level of enclosure.
2. **Enclosure is opt-in and means elevation.** Only surfaces that float above the
   page get a box: dialogs, popovers, sheets, the master-detail pane, alert-like
   summaries. Everything else is an open section.
3. **Numbers are the content.** Figures are set in the mono face with tabular
   numerals so columns align. In a numbers-heavy sim, aligned figures are both the
   aesthetic and the usability win.
4. **One motif.** The double rule (thin over thick) under page headers is the single
   recurring decoration. Do not add further ornament.
5. **Spend boldness in one place.** The display face appears on titles only; the
   seal accent appears on decree-like moments only. Everything else stays quiet.

## Type roles

| Role    | Face                | Tailwind                 | Use for                                                         | Never for                                    |
| ------- | ------------------- | ------------------------ | --------------------------------------------------------------- | -------------------------------------------- |
| Display | Marcellus           | `font-display`           | Page titles, nation/settlement names in headers                 | Body text, buttons, nav, section titles      |
| Body/UI | Geist Variable      | `font-sans` (default)    | Everything not listed elsewhere                                 | —                                            |
| Figures | Geist Mono Variable | `font-mono tabular-nums` | Stat values, treasury/population numbers, numeric table columns | Prose, labels                                |
| Eyebrow | Geist, small caps   | `.eyebrow` class         | Section titles, stat labels, definition-row labels              | Long text; anything needing emphasis by size |

Reference treatments:

- Page title: `font-display text-2xl leading-tight tracking-normal break-words`
- Stat figure: `font-mono text-2xl leading-none font-semibold tabular-nums`
- Eyebrow: the `.eyebrow` component class (0.6875rem, 600, uppercase, 0.12em
  tracking, muted foreground) — don't hand-roll these values.

## Color

All tokens are OKLCH in `src/index.css` (`:root` light, `.dark` dark, exposed via
`@theme inline`). Highlights:

- **Neutrals** are warmed toward ink-on-paper (hue ~75–85, low chroma):
  `--background`, `--foreground`, `--muted`, `--border`. Don't introduce pure
  grays or pure white next to them.
- **Primary** stays the blue (hue 262) for interactive emphasis: buttons, links,
  active nav, focus rings.
- **Seal** (`--seal`, wax red ~hue 25; `bg-seal` / `text-seal`) marks decree-like
  and destructive emphasis and the seal motif. It is _not_ a general accent — if a
  screen shows seal red in more than one place, one of them is wrong.
  `--destructive` keeps its usual semantics for form errors and destructive buttons.
- **Categorical palette** `--category-1..8` (+`-foreground`) is for entity identity
  (cultures, religions, nations) and charts. Tinted backgrounds come from
  `color-mix(... 16%, var(--background))`. Don't use these for status; status uses
  `success`/`warning`/`destructive` tones (see **Status tones** below).

### Status tones

Status = success / warning / destructive, always via the semantic tokens — never
raw Tailwind palette (`bg-green-100`, `text-red-500`, `bg-amber-100`). The `bg-*`
tokens are pre-tinted paper-light surfaces and the `-foreground` tokens are the
readable colored ink; pair them. Recipes:

| Surface     | Success                                        | Warning                                        | Destructive / danger                    |
| ----------- | ---------------------------------------------- | ---------------------------------------------- | --------------------------------------- |
| Badge       | `bg-success text-success-foreground`           | `bg-warning text-warning-foreground`           | `bg-destructive/10 text-destructive`    |
| Inline text | `text-success-foreground`                      | `text-warning-foreground`                      | `text-destructive`                      |
| Meter / bar | fill `bg-success-foreground`, track `bg-muted` | fill `bg-warning-foreground`, track `bg-muted` | fill `bg-destructive`, track `bg-muted` |

- Use `Badge` (`src/components/ui/badge.tsx`) with these classes for status pills;
  don't hand-roll a rounded span.
- Meters and progress bars carry status by fill color only — the track stays
  `bg-muted`. Keep the tinted `bg-*` token for filled surfaces (badges, callouts),
  the saturated `-foreground` token for text and thin fills.
- Neutral/"no status" is `text-muted-foreground`, not a gray palette value.
- Seal red and `--destructive` are close but distinct: seal is decree/ceremony,
  destructive is danger/error. Status uses destructive, never seal.
- Both themes must be styled for every change; dark values live in `.dark` plus the
  `prefers-color-scheme` fallback block. Never hard-code a hex/oklch in a component.

## Structure primitives

### Rules

- `.rule` — hairline `<hr>`.
- `.rule-double` — thin-over-thick ledger divider. Used under page headers
  (letterhead) and nowhere else routinely.
- Row groups use `divide-y divide-border border-y border-border` — this is the
  house idiom for lists and definition grids.

### Card (`src/components/ui/card.tsx`)

Two variants; **default is `open`**:

- `open` — no background, ring, or radius. `CardHeader` sits on a `border-b`;
  `CardTitle` renders as an eyebrow. Use for every in-page section.
- `boxed` — `rounded-xl bg-card ring-1 ring-foreground/10`. Use only for elevated
  surfaces (rule 2). If you're reaching for `boxed` inside normal page flow, stop
  and use an open section.

Do not nest a `boxed` Card inside anything, and never put a bordered tile inside a
Card of either variant.

### Stat strips (`src/components/shared/StatStrip.tsx` + `StatTile.tsx`)

Page-top figures render as one ruled strip: eyebrow label + icon above, mono
tabular figure, optional context line, closed by a single hairline rule. Separators
between figures are `divide-x`, supplied by the strip's grid — tiles have no
borders or backgrounds of their own. Interactive controls (e.g. readiness toggles)
go in a tile's trailing slot, not a special box. Mobile wraps 2-up.

Use `StatStrip` — don't hand-roll its grid. Pass `as="dl"` when the strip holds
`dt`/`dd` figures so the definition-list semantics stay valid.

### Definition rows

Label/value facts (identity fields, transition metrics, office holders) are
definition grids, not tiles:

```
<dl class="grid divide-y divide-border border-y border-border">
  row: flex items-center justify-between gap-4 py-2.5
    <dt class="eyebrow">CAPITAL</dt>
    <dd class="text-sm font-medium text-right">Coil-of-Gold [pencil]</dd>
```

Empty values are `text-sm italic text-muted-foreground` ("Vacant", "Not set",
"None") — never blank, never a dash alone. Inline edit affordances live on the row.
List rows (rosters) follow the same ruled pattern with `ul`/`li` semantics kept.

### Data tables

Tables follow the ledger idiom, not a boxed grid. **Default:** a ruled header row
over `divide-y` body rows, no outer box:

```
<table class="w-full text-sm">
  <thead>
    <tr class="border-b border-border text-left">
      <th class="eyebrow py-2 font-normal">Name</th>
      <th class="eyebrow py-2 text-right font-normal">Population</th>
  <tbody class="divide-y divide-border">
    <tr>
      <td class="py-2">…</td>
      <td class="py-2 text-right font-mono tabular-nums">…</td>
```

- Column headers are eyebrows; numeric columns are `text-right font-mono
tabular-nums`. This matches definition rows and stat strips.
- Do **not** wrap tables in `overflow-x-auto rounded-lg border` as a default. That
  reads as a box (rule 1) and duplicates enclosure the page doesn't need.
- **Horizontal overflow is the one sanctioned exception.** When a wide table cannot
  shed or stack columns at mobile widths, wrap only for scroll — no border, no
  radius, no background: `<div class="-mx-4 overflow-x-auto px-4">` (negative margin
  lets the scroll area bleed to the section edge). The frame is a scroll affordance,
  not a card. Prefer making the table responsive (hide/stack low-priority columns)
  before reaching for the scroll wrapper.

### Letterhead headers

- `PageHeader` (`src/components/shared/PageHeader.tsx`): optional eyebrow →
  display-face title → muted description, actions right-aligned, closed by
  `<hr class="rule-double" />`.
- `DetailPageHeader`: entity seal/flag (~64px) beside the display-face name, a
  breadcrumb-style context line, same double rule. Quiet placeholder when no
  seal/flag is uploaded.
- Every routed page starts with one of these. Don't invent per-page header layouts.

#### Nested entity headers

`DetailPageHeader` is required for the **routed** entity — the subject of the page.
A secondary entity surfaced _inside_ a sub-panel (a charter within a nation page, a
lore entity inside a browser) does **not** get a second `DetailPageHeader`; that
would imply a second page. Instead give it a plain section head: the entity name in
`font-display text-lg`/`text-xl` (smaller than the page title) over the section's
`border-b`, optionally with a small (~32–40px) seal/flag beside it. Reserve the
double rule and the ~64px seal for the page's own `DetailPageHeader`. Rule of thumb:
one `rule-double` per page, at the top.

#### Auth and unauthenticated shells

Sign-in, set-password, and other pre-auth pages have no page subject and structurally
cannot lead with `PageHeader`/`DetailPageHeader` — this is a **sanctioned exception**.
They use the auth shell: a centered narrow column (`max-w-sm`), the app wordmark or
entity name in the display face — allowed **larger** here than in-app
(`font-display text-3xl`/`text-4xl`) since it carries the page alone — a muted
subtitle, then the form. Close the heading block with a `rule` (single hairline), not
the double rule, to keep the letterhead motif reserved for routed pages. Tokens and
type roles otherwise apply unchanged.

### Master-detail (`src/components/shared/MasterDetailLayout.tsx`)

List 2/3 + detail 1/3; the detail pane is one of the few sanctioned `boxed`
surfaces (it becomes a Sheet on mobile, so enclosure is consistent across
breakpoints).

### Selection and active states

Rings mean **elevation** (rule 2), so don't use `ring-1 ring-primary` to mark a
chosen item — it reads as a floating box and collides with focus rings. A selected
or active choosable item (tiles, list rows, choosers) uses a filled tint plus an
inset marker:

```
data-[selected=true]:bg-accent
data-[selected=true]:before:absolute before:inset-y-0 before:left-0 before:w-0.5
data-[selected=true]:before:bg-primary
```

- `bg-accent` is the quiet selected surface; the 2px inset `bg-primary` bar (or a
  leading check for multi-select) is the marker. No radius change, no ring.
- Hover on an unselected item is `hover:bg-accent/50`; keep the focus-visible ring
  (`focus-visible:ring-2 focus-visible:ring-ring`) intact — that ring is for keyboard
  focus, distinct from selection.
- The one place rings still signal selection is inside an already-elevated surface
  (a popover/command menu), where everything floats and the elevation rule is moot.

## Alerts and callouts

"Alert-like summaries" (rule 2) means the `Alert` primitive
(`src/components/ui/alert.tsx`) — a bordered callout is sanctioned **in normal page
flow** because it carries urgency, not because it elevates. Use it; don't hand-roll
`rounded-md border-destructive/40 bg-destructive/5` or amber notices.

- Variants: `default` (neutral card), `warning` (amber-tinted), `destructive`
  (destructive ink on card). `AlertTitle` + `AlertDescription` for structure, a
  leading icon as the first child (the primitive lays out the icon column), optional
  `AlertAction` top-right.
- Reach for an alert only for genuine notices — validation summaries, irreversible
  consequences, degraded state. A calm fact is a definition row or an open section,
  not a callout. If a page shows more than one or two alerts it's over-boxed.

### Settings and danger panels

Destructive-action panels (prune world data, stuck-transition recovery, SMTP
settings) are **open sections**, not self-boxed cards. The danger comes from framing,
not enclosure:

- Title the section with the seal accent (`text-seal`) — a decree-like moment — over
  the section's `border-b`, describe the consequence in muted text, and put the
  destructive `Button` (`variant="destructive"`) in the section.
- When you need to surface an irreversible consequence _within_ that section, that
  single warning is an `Alert` (`warning`/`destructive`) — the one sanctioned box
  inside the open danger section, not the section itself.
- Confirmations that must block use `AlertDialog` (already elevated), not an inline
  box.

## Heroes, dashboards, and charts

### Image heroes with overlaid text

A full-bleed image hero (world/dashboard banner) is an elevated surface, so it may
carry radius and its own type treatment. Text sits on the image via a scrim, and
color comes from tokens, not raw `text-white`:

- Lay a gradient scrim over the image (`bg-gradient-to-t from-background/90
via-background/40 to-transparent`) and set text in the theme foreground
  (`text-foreground`) so it stays legible in both themes and never hard-codes white.
- Title uses the display face; eyebrow/description follow the normal type roles. The
  hero is the page's letterhead in this case — it replaces `PageHeader`, so don't
  stack both.

### Charts

- Chart section labels and axis eyebrows use the `.eyebrow` class — don't hand-roll
  the small-caps/tracking values inline.
- Series color comes from the categorical palette (`--category-1..8`), status series
  from status `-foreground` tokens. No raw palette hexes; charts are token-driven
  like everything else.

## Radius and spacing

- Radius stays on interactive chrome: buttons, inputs, badges, boxed surfaces.
  Content sections have no radius (they have no box).
- Scale derives from `--radius: 0.625rem`; use the Tailwind radius utilities, not
  custom values.
- Sections separate with vertical space + rules, not margins on boxes. Card spacing
  comes from `--card-spacing` (size `sm` tightens it).

## Writing in the UI

- Sentence case everywhere except eyebrows (which are styled uppercase — author
  them in sentence case and let CSS transform).
- Buttons say what they do ("Upload seal", "Appoint office holder"), and the name
  survives the flow (a "Publish" button toasts "Published").
- Empty states invite action; errors say what went wrong and how to fix it.

## Dark mode

- Activation: `.dark` class on any ancestor **or** OS `prefers-color-scheme: dark`
  (unless a `.light` ancestor overrides). See `@custom-variant dark` in
  `src/index.css`.
- In-app toggle: a light/dark/system control sits in the header right cluster
  (`ThemeToggle`, next to notifications). `ThemeProvider` (`src/lib/theme.tsx`)
  persists the choice to `localStorage` and toggles the `.dark`/`.light` class
  on `<html>`; "system" removes both and defers to `prefers-color-scheme`. A
  pre-paint script in `index.html` applies the stored class before first paint
  to avoid a flash, and Sonner toasts follow the same selection.
- Every visual change is verified in both themes. Token-driven styling makes this
  nearly free — which is why hard-coded colors are banned.

## Checklist for any UI change

- [ ] No new bordered box unless it's a sanctioned elevated surface.
- [ ] Numbers in `font-mono tabular-nums`; labels as `.eyebrow`.
- [ ] Display face only on the page/entity title.
- [ ] Both themes screenshotted (dev-browser), desktop + mobile widths.
- [ ] No hard-coded colors; tokens only — status via `success`/`warning`/
      `destructive` tokens, never raw palette (`bg-green-100`, `text-red-500`).
- [ ] Tables are ruled header + `divide-y` rows, not `overflow-x-auto rounded-lg
border`; scroll wrapper only for genuine horizontal overflow.
- [ ] Callouts use the `Alert` primitive; selection uses `bg-accent` + inset marker,
      not `ring-1 ring-primary`.
- [ ] Image-hero text uses a scrim + `text-foreground`, not `text-white`; chart
      labels use `.eyebrow`.
- [ ] One `rule-double` per page (routed header only); nested entity titles and auth
      shells follow their carve-outs.
- [ ] Existing primitives (`Card`, `StatStrip`, `PageHeader`, `DetailPageHeader`,
      `Alert`, `Badge`, definition-row idiom) reused before inventing anything.

## Known deviations (debt)

- Several sections still use bare `<Card className="grid gap-4 p-4">` with manual
  padding instead of Card's slot components.
