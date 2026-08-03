import type { Religion } from "../types/religionTypes";

export type ReligionRow = {
  readonly afterlife_beliefs: string | null;
  readonly color: string;
  readonly created_at: string;
  readonly creation_myth: string | null;
  readonly deities: string | null;
  readonly description: string | null;
  readonly ethics_sins: string | null;
  readonly funerary_rites: string | null;
  readonly hierarchy_governance: string | null;
  readonly holy_days_festivals: string | null;
  readonly holy_sites: string | null;
  readonly id: string;
  readonly mythology: string | null;
  readonly name: string;
  readonly pilgrimage_devotions: string | null;
  readonly priesthood: string | null;
  readonly relationship_to_state: string | null;
  readonly rituals_ceremonies: string | null;
  readonly sacred_texts: string | null;
  readonly sects_schisms: string | null;
  readonly symbols_vestments: string | null;
  readonly taboos: string | null;
  readonly tenets: string | null;
  readonly updated_at: string;
  readonly virtues: string | null;
  readonly world_id: string;
  readonly worship_practices: string | null;
  readonly history_spread: string | null;
};

export const RELIGION_SELECT = [
  "id",
  "world_id",
  "name",
  "description",
  "color",
  "created_at",
  "updated_at",
  "deities",
  "creation_myth",
  "mythology",
  "tenets",
  "ethics_sins",
  "taboos",
  "virtues",
  "worship_practices",
  "rituals_ceremonies",
  "holy_days_festivals",
  "pilgrimage_devotions",
  "priesthood",
  "hierarchy_governance",
  "sects_schisms",
  "relationship_to_state",
  "afterlife_beliefs",
  "funerary_rites",
  "sacred_texts",
  "holy_sites",
  "symbols_vestments",
  "history_spread",
].join(",");

export function toReligion(row: ReligionRow): Religion {
  return {
    afterlifeBeliefs: row.afterlife_beliefs,
    color: row.color,
    createdAt: row.created_at,
    creationMyth: row.creation_myth,
    deities: row.deities,
    description: row.description,
    ethicsSins: row.ethics_sins,
    funeraryRites: row.funerary_rites,
    hierarchyGovernance: row.hierarchy_governance,
    historySpread: row.history_spread,
    holyDaysFestivals: row.holy_days_festivals,
    holySites: row.holy_sites,
    id: row.id,
    mythology: row.mythology,
    name: row.name,
    pilgrimageDevotions: row.pilgrimage_devotions,
    priesthood: row.priesthood,
    relationshipToState: row.relationship_to_state,
    ritualsCeremonies: row.rituals_ceremonies,
    sacredTexts: row.sacred_texts,
    sectsSchisms: row.sects_schisms,
    symbolsVestments: row.symbols_vestments,
    taboos: row.taboos,
    tenets: row.tenets,
    updatedAt: row.updated_at,
    virtues: row.virtues,
    worldId: row.world_id,
    worshipPractices: row.worship_practices,
  };
}
