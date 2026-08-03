import type { Culture } from "../types/cultureTypes";

export type CultureRow = {
  readonly architecture_craftsmanship: string | null;
  readonly arts_aesthetics: string | null;
  readonly attitudes_to_outsiders: string | null;
  readonly color: string;
  readonly core_values: string | null;
  readonly created_at: string;
  readonly cuisine_meals: string | null;
  readonly demonym: string | null;
  readonly description: string | null;
  readonly dress_fashion: string | null;
  readonly etiquette: string | null;
  readonly festivals_holidays: string | null;
  readonly funerary_customs: string | null;
  readonly gender_family_norms: string | null;
  readonly id: string;
  readonly language_dialects: string | null;
  readonly leadership_occupations: string | null;
  readonly naming_conventions: string | null;
  readonly name: string;
  readonly origins: string | null;
  readonly rites_of_passage: string | null;
  readonly sayings_idioms: string | null;
  readonly social_hierarchy: string | null;
  readonly superstitions_folklore: string | null;
  readonly taboos: string | null;
  readonly updated_at: string;
  readonly world_id: string;
};

export const CULTURE_SELECT = [
  "id",
  "world_id",
  "name",
  "description",
  "color",
  "created_at",
  "updated_at",
  "origins",
  "demonym",
  "core_values",
  "taboos",
  "etiquette",
  "gender_family_norms",
  "attitudes_to_outsiders",
  "rites_of_passage",
  "festivals_holidays",
  "superstitions_folklore",
  "funerary_customs",
  "language_dialects",
  "naming_conventions",
  "sayings_idioms",
  "arts_aesthetics",
  "architecture_craftsmanship",
  "social_hierarchy",
  "leadership_occupations",
  "cuisine_meals",
  "dress_fashion",
].join(",");

export function toCulture(row: CultureRow): Culture {
  return {
    architectureCraftsmanship: row.architecture_craftsmanship,
    artsAesthetics: row.arts_aesthetics,
    attitudesToOutsiders: row.attitudes_to_outsiders,
    color: row.color,
    coreValues: row.core_values,
    createdAt: row.created_at,
    cuisineMeals: row.cuisine_meals,
    demonym: row.demonym,
    description: row.description,
    dressFashion: row.dress_fashion,
    etiquette: row.etiquette,
    festivalsHolidays: row.festivals_holidays,
    funeraryCustoms: row.funerary_customs,
    genderFamilyNorms: row.gender_family_norms,
    id: row.id,
    languageDialects: row.language_dialects,
    leadershipOccupations: row.leadership_occupations,
    name: row.name,
    namingConventions: row.naming_conventions,
    origins: row.origins,
    ritesOfPassage: row.rites_of_passage,
    sayingsIdioms: row.sayings_idioms,
    socialHierarchy: row.social_hierarchy,
    superstitionsFolklore: row.superstitions_folklore,
    taboos: row.taboos,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
