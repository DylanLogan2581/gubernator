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
    .insert({ name: "Test Nation", world_id: worldId, is_hidden: false })
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

async function generateBasicFantasyTopology(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<void> {
  // Nation 1: Ironhold
  const { data: ironhold, error: n1Err } = await client
    .from("nations")
    .insert({ name: "Ironhold", world_id: worldId, is_hidden: false })
    .select("id")
    .maybeSingle();
  if (n1Err !== null)
    throw new Error(`create nation Ironhold: ${n1Err.message}`);
  if (ironhold === null)
    throw new Error("create nation Ironhold: no row returned");

  // Nation 2: Verdania
  const { data: verdania, error: n2Err } = await client
    .from("nations")
    .insert({ name: "Verdania", world_id: worldId, is_hidden: false })
    .select("id")
    .maybeSingle();
  if (n2Err !== null)
    throw new Error(`create nation Verdania: ${n2Err.message}`);
  if (verdania === null)
    throw new Error("create nation Verdania: no row returned");

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

  // Citizens: 2 per settlement (female + male), 6 total
  const settlementCitizens: Array<{
    settlementId: string;
    citizens: Array<{
      givenName: string;
      surname: string;
      sex: "female" | "male";
    }>;
  }> = [
    {
      settlementId: irongate.id,
      citizens: [
        { givenName: "Brynn", surname: "Hammerfell", sex: "female" },
        { givenName: "Aldric", surname: "Ironhill", sex: "male" },
      ],
    },
    {
      settlementId: verdantVale.id,
      citizens: [
        { givenName: "Calla", surname: "Greenwood", sex: "female" },
        { givenName: "Calder", surname: "Ashborne", sex: "male" },
      ],
    },
    {
      settlementId: millhaven.id,
      citizens: [
        { givenName: "Dara", surname: "Coldfen", sex: "female" },
        { givenName: "Dorin", surname: "Blackwood", sex: "male" },
      ],
    },
  ];

  for (const { settlementId, citizens } of settlementCitizens) {
    for (const { givenName, surname, sex } of citizens) {
      const { error } = await client.rpc("create_npc", {
        p_given_name: givenName,
        p_surname: surname,
        p_world_id: worldId,
        p_settlement_id: settlementId,
        p_sex: sex,
      });
      if (error !== null)
        throw new Error(`create npc ${givenName}: ${error.message}`);
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
    id: "basic-fantasy",
    name: "Basic Fantasy",
    description:
      "A classic fantasy setting with two rival nations, three settlements, " +
      "diverse resources, and a self-sustaining economy.",
    template: BASIC_FANTASY_TEMPLATE,
    generateTopology: generateBasicFantasyTopology,
  },
];
