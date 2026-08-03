export const RELIGION_LORE_FIELD_KEYS = [
  "deities",
  "creationMyth",
  "mythology",
  "tenets",
  "ethicsSins",
  "taboos",
  "virtues",
  "worshipPractices",
  "ritualsCeremonies",
  "holyDaysFestivals",
  "pilgrimageDevotions",
  "priesthood",
  "hierarchyGovernance",
  "sectsSchisms",
  "relationshipToState",
  "afterlifeBeliefs",
  "funeraryRites",
  "sacredTexts",
  "holySites",
  "symbolsVestments",
  "historySpread",
] as const;

export type ReligionLoreFieldKey = (typeof RELIGION_LORE_FIELD_KEYS)[number];

export type ReligionLoreFields = {
  readonly [K in ReligionLoreFieldKey]: string | null;
};

export type Religion = {
  readonly color: string;
  readonly createdAt: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
  readonly worldId: string;
} & ReligionLoreFields;
