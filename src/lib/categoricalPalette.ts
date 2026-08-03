/**
 * Fixed 8-slot categorical color palette — shared identity colors for icon
 * chips, avatar fallbacks, and (future) chart series. Backed by the
 * `--category-1..8` / `--category-N-foreground` CSS tokens in `index.css`
 * (see that file for the source values and light/dark handling).
 *
 * Class names are listed as literal strings (not built via template
 * interpolation) so Tailwind's static scanner picks them up.
 */
export const CATEGORICAL_SLOT_COUNT = 8;

const CATEGORICAL_CHIP_CLASSNAMES: readonly string[] = [
  "bg-category-1 text-category-1-foreground",
  "bg-category-2 text-category-2-foreground",
  "bg-category-3 text-category-3-foreground",
  "bg-category-4 text-category-4-foreground",
  "bg-category-5 text-category-5-foreground",
  "bg-category-6 text-category-6-foreground",
  "bg-category-7 text-category-7-foreground",
  "bg-category-8 text-category-8-foreground",
];

const CATEGORICAL_FOREGROUND_CLASSNAMES: readonly string[] = [
  "text-category-1-foreground",
  "text-category-2-foreground",
  "text-category-3-foreground",
  "text-category-4-foreground",
  "text-category-5-foreground",
  "text-category-6-foreground",
  "text-category-7-foreground",
  "text-category-8-foreground",
];

export type CategoricalSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Chip classes (tinted background + matching icon/text color) for a slot. */
export function categoricalChipClassName(slot: CategoricalSlot): string {
  return CATEGORICAL_CHIP_CLASSNAMES[slot - 1];
}

/** Just the foreground/text color for a slot (e.g. avatar fallback text). */
export function categoricalForegroundClassName(slot: CategoricalSlot): string {
  return CATEGORICAL_FOREGROUND_CLASSNAMES[slot - 1];
}

/**
 * Raw CSS color for a slot's foreground token (e.g. `var(--category-3-foreground)`).
 * For contexts that need an actual paintable color rather than a Tailwind
 * class — chart fills/strokes (recharts, canvas) can't consume `bg-*`/`text-*`
 * classes.
 */
export function categoricalForegroundCssVar(slot: CategoricalSlot): string {
  return `var(--category-${String(slot)}-foreground)`;
}

// Deterministic string hash (djb2-style, no RNG) — stable across renders and
// sessions for a given id, matching the prior art in WorldListPage's
// worldIconPalette.
export function hashToCategoricalSlot(seed: string): CategoricalSlot {
  let hash = 0;
  for (const char of seed) {
    // `| 0` keeps the accumulator within 32-bit signed range (avoiding float
    // precision loss for long seeds) without collapsing the hash space early —
    // the reduction to CATEGORICAL_SLOT_COUNT happens once, after the full seed
    // has been folded in, so adjacent UUIDs don't cluster onto adjacent slots.
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return ((Math.abs(hash) % CATEGORICAL_SLOT_COUNT) + 1) as CategoricalSlot;
}

/**
 * Resolves the categorical slot to render for a config entity's icon chip:
 * the stored `icon_color` when set, otherwise the stable UUID-hash fallback
 * (see `hashToCategoricalSlot`). Use everywhere an entity's icon chip tone is
 * derived (config tables, settlement instance rows, forecasts, reports).
 */
export function resolveIconTone(
  iconColor: number | null | undefined,
  id: string,
): CategoricalSlot {
  if (
    iconColor !== null &&
    iconColor !== undefined &&
    iconColor >= 1 &&
    iconColor <= CATEGORICAL_SLOT_COUNT
  ) {
    return iconColor as CategoricalSlot;
  }
  return hashToCategoricalSlot(id);
}
