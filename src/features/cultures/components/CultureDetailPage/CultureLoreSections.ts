import type { CultureLoreFieldKey } from "../../types/cultureTypes";

export type CultureLoreSection = {
  readonly title: string;
  readonly fields: readonly {
    readonly key: CultureLoreFieldKey;
    readonly label: string;
  }[];
};

export const CULTURE_LORE_SECTIONS: readonly CultureLoreSection[] = [
  {
    title: "Identity & Origins",
    fields: [
      { key: "origins", label: "Origins" },
      { key: "demonym", label: "Demonym" },
    ],
  },
  {
    title: "Values & Ethics",
    fields: [
      { key: "coreValues", label: "Core values" },
      { key: "taboos", label: "Taboos" },
      { key: "etiquette", label: "Etiquette" },
      { key: "genderFamilyNorms", label: "Gender & family norms" },
      { key: "attitudesToOutsiders", label: "Attitudes to outsiders" },
    ],
  },
  {
    title: "Customs & Traditions",
    fields: [
      { key: "ritesOfPassage", label: "Rites of passage" },
      { key: "festivalsHolidays", label: "Festivals & holidays" },
      { key: "superstitionsFolklore", label: "Superstitions & folklore" },
      { key: "funeraryCustoms", label: "Funerary customs" },
    ],
  },
  {
    title: "Language & Naming",
    fields: [
      { key: "languageDialects", label: "Language & dialects" },
      { key: "namingConventions", label: "Naming conventions" },
      { key: "sayingsIdioms", label: "Sayings & idioms" },
    ],
  },
  {
    title: "Arts & Aesthetics",
    fields: [
      { key: "artsAesthetics", label: "Arts & aesthetics" },
      {
        key: "architectureCraftsmanship",
        label: "Architecture & craftsmanship",
      },
    ],
  },
  {
    title: "Social Structure",
    fields: [
      { key: "socialHierarchy", label: "Social hierarchy" },
      { key: "leadershipOccupations", label: "Leadership & occupations" },
    ],
  },
  {
    title: "Daily Life",
    fields: [
      { key: "cuisineMeals", label: "Cuisine & meals" },
      { key: "dressFashion", label: "Dress & fashion" },
    ],
  },
];
