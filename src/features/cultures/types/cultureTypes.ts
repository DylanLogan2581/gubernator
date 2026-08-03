export const CULTURE_LORE_FIELD_KEYS = [
  "origins",
  "demonym",
  "coreValues",
  "taboos",
  "etiquette",
  "genderFamilyNorms",
  "attitudesToOutsiders",
  "ritesOfPassage",
  "festivalsHolidays",
  "superstitionsFolklore",
  "funeraryCustoms",
  "languageDialects",
  "namingConventions",
  "sayingsIdioms",
  "artsAesthetics",
  "architectureCraftsmanship",
  "socialHierarchy",
  "leadershipOccupations",
  "cuisineMeals",
  "dressFashion",
] as const;

export type CultureLoreFieldKey = (typeof CULTURE_LORE_FIELD_KEYS)[number];

export type CultureLoreFields = {
  readonly [K in CultureLoreFieldKey]: string | null;
};

export type Culture = {
  readonly color: string;
  readonly createdAt: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
  readonly worldId: string;
} & CultureLoreFields;
