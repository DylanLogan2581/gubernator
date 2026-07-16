// Heuristic filter for the two site categories we crawl ("Real Names" and
// "Fantasy & Folklore" — the site's own taxonomy for real-world cultures and
// fantasy races/folklore, matching the issue's "person-name generator" scope).
// Some entries in those categories name species, groups, or classifications
// rather than individuals; this denylist catches the ones identified by
// inspecting the live category listing.

const DENYLIST_PATTERNS: RegExp[] = [
  /^pet-/, // pet species naming, not person names
  /-classifications?\.php$/,
  /-types?\.php$/,
  /^species-names\.php$/,
  /^animal-species-names\.php$/,
  /^mutant-species-names\.php$/,
  /^fantasy-animal-names\.php$/,
  /-clan-names\.php$/,
  /-pack-names\.php$/,
  /-coven-names\.php$/,
  /-team-names\.php$/,
  /-sect-names\.php$/,
  /-court-names\.php$/,
  /-grove-names\.php$/,
  /character-titles\.php$/,
  /^fantasy-race-names\.php$/,
];

const DENYLIST_HREFS = new Set<string>([
  "ghost-classifications.php",
  "zombie-types.php",
]);

export function isExcludedGenerator(href: string): boolean {
  if (DENYLIST_HREFS.has(href)) return true;
  return DENYLIST_PATTERNS.some((pattern) => pattern.test(href));
}
