import type { GubernatorSupabaseClient } from "@/lib/supabase";
import {
  worldTemplateSchema,
  type WorldTemplate,
} from "@/shared/worldTemplateSchema";

import basicFantasyRaw from "./basic-fantasy.json";
import minimalTestWorldRaw from "./minimal-test-world.json";

import type { BundledScenario } from "./scenarioTypes";

// ---------------------------------------------------------------------------
// Validate bundled JSON files against the schema at module load time.
// A broken JSON file is a programming error, so parse() (not safeParse) is
// appropriate: it throws immediately rather than returning a partial value.
// ---------------------------------------------------------------------------
const MINIMAL_TEST_WORLD_TEMPLATE: WorldTemplate =
  worldTemplateSchema.parse(minimalTestWorldRaw);
const BASIC_FANTASY_TEMPLATE: WorldTemplate =
  worldTemplateSchema.parse(basicFantasyRaw);

// ---------------------------------------------------------------------------
// Topology generators
// ---------------------------------------------------------------------------

async function generateMinimalTestWorldTopology(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<void> {
  // 1. Nation
  const { data: nation, error: nErr } = await client
    .from("nations")
    .insert({ name: "Test Nation", world_id: worldId })
    .select("id")
    .maybeSingle();
  if (nErr !== null) throw new Error(`create nation: ${nErr.message}`);
  if (nation === null) throw new Error("create nation: no row returned");

  // 2. Settlement
  const { data: settlement, error: sErr } = await client
    .from("settlements")
    .insert({ name: "Test Settlement", nation_id: nation.id })
    .select("id")
    .maybeSingle();
  if (sErr !== null) throw new Error(`create settlement: ${sErr.message}`);
  if (settlement === null)
    throw new Error("create settlement: no row returned");

  // 3. Citizens (female + male so partnership phase has both sexes)
  for (const [givenName, sex] of [
    ["Ada", "female"],
    ["Bram", "male"],
  ] as const) {
    const { error } = await client.rpc("create_npc", {
      p_given_name: givenName,
      p_world_id: worldId,
      p_settlement_id: settlement.id,
      p_sex: sex,
    });
    if (error !== null)
      throw new Error(`create npc ${givenName}: ${error.message}`);
  }
}

/**
 * Fetches the world-scoped id for a row created by `import_world_from_template`
 * (culture, religion, or education level), looked up by its template name.
 */
async function lookupIdByName(
  client: GubernatorSupabaseClient,
  table: "cultures" | "religions" | "education_levels",
  worldId: string,
  name: string,
): Promise<string> {
  const { data, error } = await client
    .from(table)
    .select("id")
    .eq("world_id", worldId)
    .eq("name", name)
    .maybeSingle();
  if (error !== null)
    throw new Error(`lookup ${table} "${name}": ${error.message}`);
  if (data === null)
    throw new Error(`lookup ${table} "${name}": no row returned`);
  return data.id;
}

async function generateFlagshipRealmTopology(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<void> {
  // -------------------------------------------------------------------------
  // Look up the cultures/religions/education levels seeded by
  // import_world_from_template so citizens (and nations) can be assigned to
  // them below.
  // -------------------------------------------------------------------------
  const [ironholdCultureId, verdanianCultureId] = await Promise.all([
    lookupIdByName(client, "cultures", worldId, "Ironhold Folk"),
    lookupIdByName(client, "cultures", worldId, "Verdanian"),
  ]);
  const [forgeReligionId, oldGodsReligionId] = await Promise.all([
    lookupIdByName(client, "religions", worldId, "Faith of the Forge"),
    lookupIdByName(client, "religions", worldId, "Old Gods of the Green"),
  ]);
  const [literateId, educatedId, scholarId] = await Promise.all([
    lookupIdByName(client, "education_levels", worldId, "Literate"),
    lookupIdByName(client, "education_levels", worldId, "Educated"),
    lookupIdByName(client, "education_levels", worldId, "Scholar"),
  ]);

  // Nation 1: Ironhold
  const { data: ironhold, error: n1Err } = await client
    .from("nations")
    .insert({ name: "Ironhold", world_id: worldId })
    .select("id")
    .maybeSingle();
  if (n1Err !== null)
    throw new Error(`create nation Ironhold: ${n1Err.message}`);
  if (ironhold === null)
    throw new Error("create nation Ironhold: no row returned");

  // Nation 2: Verdania
  const { data: verdania, error: n2Err } = await client
    .from("nations")
    .insert({ name: "Verdania", world_id: worldId })
    .select("id")
    .maybeSingle();
  if (n2Err !== null)
    throw new Error(`create nation Verdania: ${n2Err.message}`);
  if (verdania === null)
    throw new Error("create nation Verdania: no row returned");

  const { error: n1CultureErr } = await client.rpc(
    "set_nation_culture_religion",
    {
      p_nation_id: ironhold.id,
      p_primary_culture_id: ironholdCultureId,
      p_state_religion_id: forgeReligionId,
    },
  );
  if (n1CultureErr !== null)
    throw new Error(
      `set nation Ironhold culture/religion: ${n1CultureErr.message}`,
    );

  const { error: n2CultureErr } = await client.rpc(
    "set_nation_culture_religion",
    {
      p_nation_id: verdania.id,
      p_primary_culture_id: verdanianCultureId,
      p_state_religion_id: oldGodsReligionId,
    },
  );
  if (n2CultureErr !== null)
    throw new Error(
      `set nation Verdania culture/religion: ${n2CultureErr.message}`,
    );

  // Ironhold settlement
  const { data: irongate, error: s1Err } = await client
    .from("settlements")
    .insert({ name: "Irongate", nation_id: ironhold.id })
    .select("id")
    .maybeSingle();
  if (s1Err !== null)
    throw new Error(`create settlement Irongate: ${s1Err.message}`);
  if (irongate === null)
    throw new Error("create settlement Irongate: no row returned");

  // Verdania settlements
  const { data: verdantVale, error: s2Err } = await client
    .from("settlements")
    .insert({ name: "Verdant Vale", nation_id: verdania.id })
    .select("id")
    .maybeSingle();
  if (s2Err !== null)
    throw new Error(`create settlement Verdant Vale: ${s2Err.message}`);
  if (verdantVale === null)
    throw new Error("create settlement Verdant Vale: no row returned");

  const { data: millhaven, error: s3Err } = await client
    .from("settlements")
    .insert({ name: "Millhaven", nation_id: verdania.id })
    .select("id")
    .maybeSingle();
  if (s3Err !== null)
    throw new Error(`create settlement Millhaven: ${s3Err.message}`);
  if (millhaven === null)
    throw new Error("create settlement Millhaven: no row returned");

  // Citizens: assigned a culture, religion, and (for some) an education
  // level, to showcase the full config layer on the citizens page.
  const settlementCitizens: Array<{
    settlementId: string;
    cultureId: string;
    religionId: string;
    citizens: Array<{
      givenName: string;
      surname: string;
      sex: "female" | "male";
      educationLevelId: string | null;
    }>;
  }> = [
    {
      settlementId: irongate.id,
      cultureId: ironholdCultureId,
      religionId: forgeReligionId,
      citizens: [
        {
          givenName: "Brynn",
          surname: "Hammerfell",
          sex: "female",
          educationLevelId: literateId,
        },
        {
          givenName: "Aldric",
          surname: "Ironhill",
          sex: "male",
          educationLevelId: null,
        },
        {
          givenName: "Gareth",
          surname: "Frostholm",
          sex: "male",
          educationLevelId: educatedId,
        },
      ],
    },
    {
      settlementId: verdantVale.id,
      cultureId: verdanianCultureId,
      religionId: oldGodsReligionId,
      citizens: [
        {
          givenName: "Calla",
          surname: "Ashborne",
          sex: "female",
          educationLevelId: literateId,
        },
        {
          givenName: "Calder",
          surname: "Blackwood",
          sex: "male",
          educationLevelId: null,
        },
      ],
    },
    {
      settlementId: millhaven.id,
      cultureId: verdanianCultureId,
      religionId: oldGodsReligionId,
      citizens: [
        {
          givenName: "Dara",
          surname: "Coldfen",
          sex: "female",
          educationLevelId: scholarId,
        },
        {
          givenName: "Dorin",
          surname: "Dawnridge",
          sex: "male",
          educationLevelId: null,
        },
      ],
    },
  ];

  for (const {
    settlementId,
    cultureId,
    religionId,
    citizens,
  } of settlementCitizens) {
    for (const { givenName, surname, sex, educationLevelId } of citizens) {
      const { data: citizen, error } = await client
        .rpc("create_npc", {
          p_given_name: givenName,
          p_surname: surname,
          p_world_id: worldId,
          p_settlement_id: settlementId,
          p_sex: sex,
        })
        .maybeSingle();
      if (error !== null)
        throw new Error(`create npc ${givenName}: ${error.message}`);
      if (citizen === null)
        throw new Error(`create npc ${givenName}: no row returned`);

      const { error: cultureErr } = await client.rpc(
        "set_citizen_culture_religion",
        {
          p_citizen_id: citizen.id,
          p_culture_id: cultureId,
          p_religion_id: religionId,
        },
      );
      if (cultureErr !== null)
        throw new Error(
          `set citizen ${givenName} culture/religion: ${cultureErr.message}`,
        );

      if (educationLevelId !== null) {
        const { error: educationErr } = await client.rpc(
          "set_citizen_education",
          {
            p_citizen_id: citizen.id,
            p_education_level_id: educationLevelId,
          },
        );
        if (educationErr !== null)
          throw new Error(
            `set citizen ${givenName} education: ${educationErr.message}`,
          );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const BUNDLED_SCENARIOS: ReadonlyArray<BundledScenario> = [
  {
    id: "minimal-test-world",
    name: "Minimal Test World",
    description:
      "A bare-bones world for fast testing and development. " +
      "One nation, one settlement, two citizens.",
    template: MINIMAL_TEST_WORLD_TEMPLATE,
    generateTopology: generateMinimalTestWorldTopology,
  },
  {
    id: "flagship-realm",
    name: "Ironhold & Verdania",
    description:
      "A deeply-built fantasy realm showcasing every configurable system: " +
      "resource categories, an education ladder with a teacher-staffed " +
      "school, cultures, religions, deposits, a managed cattle herd, and " +
      "recruitable unit types, spread across two rival nations and three " +
      "settlements.",
    template: BASIC_FANTASY_TEMPLATE,
    generateTopology: generateFlagshipRealmTopology,
  },
];
