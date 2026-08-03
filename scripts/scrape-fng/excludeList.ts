// Heuristic filter for the site categories we crawl ("Real Names",
// "Fantasy & Folklore" and "Pop Culture" — the site's own taxonomy for
// real-world cultures, fantasy races/folklore and franchise character/race
// generators, matching the issue's "person-name generator" scope). Those
// categories also carry generators for places, buildings, ships, objects,
// abilities, groups and animals rather than individuals; this denylist keeps
// the library to person/sentient-race names only. Fantasy sentient races
// (elves, orcs, Klingons, …) count as people; animals, monsters-as-beasts,
// dragons, vehicles and objects do not.

const DENYLIST_PATTERNS: RegExp[] = [
  /^pet-/, // pet species naming, not person names
  /-classifications?\.php$/,
  /-types?\.php$/,
  /^species-names\.php$/,
  /^animal-species-names\.php$/,
  /-animal-species-names\.php$/,
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
  // Places, buildings and locations.
  /-place-names\.php$/,
  /-places-names\.php$/,
  /-town-names\.php$/,
  /-city-names\.php$/,
  /-island-names\.php$/,
  /-zone-names\.php$/,
  /-planet-names\.php$/,
  /-store-names\.php$/,
  // Vehicles and vessels.
  /-ship-names\.php$/,
  /-spaceship-names\.php$/,
  // Groups, houses and organizations.
  /-organization-names\.php$/,
  /-crew-names\.php$/,
  /-house-names\.php$/,
  // Titles, nicknames, roles and descriptions (not individual names).
  /-titles\.php$/,
  /-nicknames\.php$/,
  /-descriptions?\.php$/,
  /-ultimates\.php$/,
  // Abilities, powers, weapons and objects.
  /-jutsu-names\.php$/,
  /-dojutsu-names\.php$/,
  /-devil-fruit-names\.php$/,
  /-cursed-technique-names\.php$/,
  /-cursed-tool-names\.php$/,
  /-domain-expansion-names\.php$/,
  /-semblances\.php$/,
  /-quirks\.php$/,
  /-constellations\.php$/,
  /-combat-forms\.php$/,
  /-attack-names\.php$/,
  // Animals, beasts, mounts and creatures (not sentient people).
  /-dragon-names\.php$/,
  /-dragon-species-names\.php$/,
  /-winged-horse-names\.php$/,
  /-hippogriff-names\.php$/,
  /-machine-names\.php$/,
  /-monster-names\.php$/,
  /-chao-names\.php$/,
  /-monkey-lizard-names\.php$/,
  /-awakened-animal-names\.php$/,
  /^minecraft-/, // Minecraft mobs are creatures, not people.
];

const DENYLIST_HREFS = new Set<string>([
  "ghost-classifications.php",
  "zombie-types.php",
  // Pop-culture animals and creatures without a systematic suffix.
  "pokemon-names.php",
  "digimon-names.php",
  "warrior-cat-names.php",
  "avatar-spirit-names.php",
  "narnia-badger-names.php",
  "narnia-horse-names.php",
  "narnia-hedgehog-names.php",
  "narnia-mole-names.php",
  "narnia-mouse-names.php",
  "narnia-owl-names.php",
  "narnia-squirrel-names.php",
  "narnia-wolf-names.php",
  "narnia-star-names.php",
  "monster-hunter-flying-wyvern-names.php",
  "monster-hunter-brute-wyvern-names.php",
  "monster-hunter-fanged-beast-names.php",
  "monster-hunter-herbivore-names.php",
  "monster-hunter-leviathan-names.php",
  "monster-hunter-wingdrake-names.php",
  // WoW "battle pet" animal sub-category.
  "wow-pet-names.php",
  "bat-dragonhawk-names.php",
  "boars-bears-names.php",
  "bird-names.php",
  "cat-names.php",
  "crab-names.php",
  "insect-names.php",
  "dino-rhino-names.php",
  "dog-wolf-names.php",
  "goat-porcupine-names.php",
  "gorilla-monkey-names.php",
  "reptile-names.php",
]);

export function isExcludedGenerator(href: string): boolean {
  if (DENYLIST_HREFS.has(href)) return true;
  return DENYLIST_PATTERNS.some((pattern) => pattern.test(href));
}
