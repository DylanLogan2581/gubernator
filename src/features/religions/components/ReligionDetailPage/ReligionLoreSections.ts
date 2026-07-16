import type { ReligionLoreFieldKey } from "../../types/religionTypes";

export type ReligionLoreSection = {
  readonly title: string;
  readonly fields: readonly {
    readonly key: ReligionLoreFieldKey;
    readonly label: string;
  }[];
};

export const RELIGION_LORE_SECTIONS: readonly ReligionLoreSection[] = [
  {
    title: "Deities & Cosmology",
    fields: [
      { key: "deities", label: "Deities" },
      { key: "creationMyth", label: "Creation myth" },
      { key: "mythology", label: "Mythology" },
    ],
  },
  {
    title: "Tenets & Morality",
    fields: [
      { key: "tenets", label: "Tenets" },
      { key: "ethicsSins", label: "Ethics & sins" },
      { key: "taboos", label: "Taboos" },
      { key: "virtues", label: "Virtues" },
    ],
  },
  {
    title: "Practices & Rituals",
    fields: [
      { key: "worshipPractices", label: "Worship practices" },
      { key: "ritualsCeremonies", label: "Rituals & ceremonies" },
      { key: "holyDaysFestivals", label: "Holy days & festivals" },
      { key: "pilgrimageDevotions", label: "Pilgrimage & devotions" },
    ],
  },
  {
    title: "Clergy & Organization",
    fields: [
      { key: "priesthood", label: "Priesthood" },
      { key: "hierarchyGovernance", label: "Hierarchy & governance" },
      { key: "sectsSchisms", label: "Sects & schisms" },
      { key: "relationshipToState", label: "Relationship to the state" },
    ],
  },
  {
    title: "Death & Afterlife",
    fields: [
      { key: "afterlifeBeliefs", label: "Afterlife beliefs" },
      { key: "funeraryRites", label: "Funerary rites" },
    ],
  },
  {
    title: "Texts, Sites & Symbols",
    fields: [
      { key: "sacredTexts", label: "Sacred texts" },
      { key: "holySites", label: "Holy sites" },
      { key: "symbolsVestments", label: "Symbols & vestments" },
      { key: "historySpread", label: "History & spread" },
    ],
  },
];
