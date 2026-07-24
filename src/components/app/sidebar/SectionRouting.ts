// Route parsing for the scoped sidebar groups (SETTLEMENT / NATION): derives
// the active section from the pathname suffix past a scope's base route. Kept
// free of JSX/layout so config and layout can each import it in isolation.

// Derives the active sidebar section from the pathname suffix past `basePath`
// — the suffix mirrors the scope's detail child routes 1:1. An unrecognized
// suffix falls back to `fallback` (rather than leaving the group with no
// active item). When `nullSubtreePrefix` is set, a suffix under that prefix
// returns null instead: NATION has a real subtree below it that isn't one of
// its own sections — the settlement-detail routes — so `settlements/<id>`
// must highlight nothing rather than falling back to the nation overview.
export function sectionFromPathname<Section extends string>(
  pathname: string,
  basePath: string,
  {
    fallback,
    nullSubtreePrefix,
    segments,
  }: {
    readonly fallback: Section;
    readonly nullSubtreePrefix?: string;
    readonly segments: ReadonlySet<Section>;
  },
): Section | null {
  const suffix = pathname.slice(basePath.length);
  const segment = suffix.startsWith("/") ? suffix.slice(1) : suffix;
  if (
    nullSubtreePrefix !== undefined &&
    segment.startsWith(nullSubtreePrefix)
  ) {
    return null;
  }
  return segment !== "" && (segments as ReadonlySet<string>).has(segment)
    ? (segment as Section)
    : fallback;
}
