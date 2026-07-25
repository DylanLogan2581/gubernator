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
  `success`/`warning`/`destructive` tones.
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

Use `StatStrip` — don't hand-roll its grid (one legacy hand-rolled copy exists in
`TurnTransitionOutcomePanel`; treat it as debt, not precedent).

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

### Letterhead headers

- `PageHeader` (`src/components/shared/PageHeader.tsx`): optional eyebrow →
  display-face title → muted description, actions right-aligned, closed by
  `<hr class="rule-double" />`.
- `DetailPageHeader`: entity seal/flag (~64px) beside the display-face name, a
  breadcrumb-style context line, same double rule. Quiet placeholder when no
  seal/flag is uploaded.
- Every routed page starts with one of these. Don't invent per-page header layouts.

### Master-detail (`src/components/shared/MasterDetailLayout.tsx`)

List 2/3 + detail 1/3; the detail pane is one of the few sanctioned `boxed`
surfaces (it becomes a Sheet on mobile, so enclosure is consistent across
breakpoints).

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
- There is currently **no in-app toggle**; the app follows the OS. For manual
  testing use DevTools rendering emulation or set the class on `<html>` (see
  README of this doc's PR / verification workflow).
- Every visual change is verified in both themes. Token-driven styling makes this
  nearly free — which is why hard-coded colors are banned.

## Checklist for any UI change

- [ ] No new bordered box unless it's a sanctioned elevated surface.
- [ ] Numbers in `font-mono tabular-nums`; labels as `.eyebrow`.
- [ ] Display face only on the page/entity title.
- [ ] Both themes screenshotted (dev-browser), desktop + mobile widths.
- [ ] No hard-coded colors; tokens only.
- [ ] Existing primitives (`Card`, `StatStrip`, `PageHeader`, `DetailPageHeader`,
      definition-row idiom) reused before inventing anything.

## Known deviations (debt)

- `TurnTransitionOutcomePanel` hand-rolls the StatStrip grid.
- Several sections still use bare `<Card className="grid gap-4 p-4">` with manual
  padding instead of Card's slot components.
- No theme toggle UI (see Dark mode above).
