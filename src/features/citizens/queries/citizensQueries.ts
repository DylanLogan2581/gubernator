import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { UNASSIGNED_CULTURE_RELIGION_KEY } from "../types/citizenTypes";

import { citizensQueryKeys } from "./citizensQueryKeys";

import type {
  Citizen,
  CitizenAdminDetails,
  CitizenAggregateStats,
  CitizenAssignmentType,
  CitizenRoleType,
  CitizenStatus,
  CitizenType,
  CultureReligionComposition,
  DeathCauseCategory,
} from "../types/citizenTypes";

type CitizenAdminDetailsQueryKey = ReturnType<
  typeof citizensQueryKeys.adminDetails
>;
type CitizenListQueryKey = ReturnType<typeof citizensQueryKeys.settlementList>;
type CitizenDetailQueryKey = ReturnType<typeof citizensQueryKeys.detail>;
type PlayerCharactersInNationQueryKey = ReturnType<
  typeof citizensQueryKeys.playerCharactersInNation
>;
type SettlementManagersInNationQueryKey = ReturnType<
  typeof citizensQueryKeys.settlementManagersInNation
>;
type UnpairedAliveInWorldQueryKey = ReturnType<
  typeof citizensQueryKeys.unpairedAliveInWorld
>;
type CitizenSettlementAggregateQueryKey = ReturnType<
  typeof citizensQueryKeys.settlementAggregateStats
>;
type CitizenNationAggregateQueryKey = ReturnType<
  typeof citizensQueryKeys.nationAggregateStats
>;
type CitizenSettlementCultureReligionCompositionQueryKey = ReturnType<
  typeof citizensQueryKeys.settlementCultureReligionComposition
>;
type CitizenNationCultureReligionCompositionQueryKey = ReturnType<
  typeof citizensQueryKeys.nationCultureReligionComposition
>;

type CitizenListQueryOptions = UseQueryOptions<
  readonly Citizen[],
  AuthUiError,
  readonly Citizen[],
  CitizenListQueryKey
>;
type UnpairedAliveInWorldQueryOptions = UseQueryOptions<
  readonly Citizen[],
  AuthUiError,
  readonly Citizen[],
  UnpairedAliveInWorldQueryKey
>;
type CitizensInWorldQueryKey = ReturnType<typeof citizensQueryKeys.worldList>;
type CitizensInWorldQueryOptions = UseQueryOptions<
  readonly Citizen[],
  AuthUiError,
  readonly Citizen[],
  CitizensInWorldQueryKey
>;
type CitizenAdminDetailsQueryOptions = UseQueryOptions<
  CitizenAdminDetails | null,
  AuthUiError,
  CitizenAdminDetails | null,
  CitizenAdminDetailsQueryKey
>;
type CitizenDetailQueryOptions = UseQueryOptions<
  Citizen | null,
  AuthUiError,
  Citizen | null,
  CitizenDetailQueryKey
>;
type PlayerCharactersInNationQueryOptions = UseQueryOptions<
  readonly Citizen[],
  AuthUiError,
  readonly Citizen[],
  PlayerCharactersInNationQueryKey
>;
type SettlementManagersInNationQueryOptions = UseQueryOptions<
  readonly Citizen[],
  AuthUiError,
  readonly Citizen[],
  SettlementManagersInNationQueryKey
>;
type CitizenSettlementAggregateQueryOptions = UseQueryOptions<
  CitizenAggregateStats,
  AuthUiError,
  CitizenAggregateStats,
  CitizenSettlementAggregateQueryKey
>;
type CitizenNationAggregateQueryOptions = UseQueryOptions<
  CitizenAggregateStats,
  AuthUiError,
  CitizenAggregateStats,
  CitizenNationAggregateQueryKey
>;
type CitizenSettlementCultureReligionCompositionQueryOptions = UseQueryOptions<
  CultureReligionComposition,
  AuthUiError,
  CultureReligionComposition,
  CitizenSettlementCultureReligionCompositionQueryKey
>;
type CitizenNationCultureReligionCompositionQueryOptions = UseQueryOptions<
  CultureReligionComposition,
  AuthUiError,
  CultureReligionComposition,
  CitizenNationCultureReligionCompositionQueryKey
>;

type CitizenRow = {
  readonly born_on_turn_number: number | null;
  readonly citizen_type: CitizenType;
  readonly created_at: string;
  readonly culture_id: string | null;
  readonly death_cause: string | null;
  readonly death_cause_category: DeathCauseCategory | null;
  readonly education_level_id: string | null;
  readonly given_name: string;
  readonly id: string;
  readonly name: string;
  readonly nameset_id: string | null;
  readonly parent_a_citizen_id: string | null;
  readonly parent_b_citizen_id: string | null;
  readonly profile_photo_url: string | null;
  readonly religion_id: string | null;
  readonly role_nation_id: string | null;
  readonly role_settlement_id: string | null;
  readonly role_type: CitizenRoleType;
  readonly settlement_id: string | null;
  readonly sex: string | null;
  readonly status: CitizenStatus;
  readonly surname: string | null;
  readonly updated_at: string;
  readonly user_id: string | null;
  readonly world_id: string;
};

type CitizenAdminDetailsRow = {
  readonly npc_flaw: string | null;
  readonly npc_goal: string | null;
  readonly npc_secret_contradiction: string | null;
  readonly npc_trait_1: string | null;
  readonly npc_trait_2: string | null;
  readonly personality_text: string | null;
  readonly skills_text: string | null;
};

type CitizenAggregateRow = {
  readonly citizen_type: CitizenType;
  readonly id: string;
  readonly status: CitizenStatus;
};

type CitizenAggregateWithAssignmentRow = CitizenAggregateRow & {
  // citizen_id is the primary key of citizen_assignments, so PostgREST embeds
  // this as a single object (not an array) for the 1:1 relationship.
  readonly citizen_assignments: {
    readonly assignment_type: CitizenAssignmentType;
  } | null;
};

const CITIZEN_SELECT =
  "id,world_id,settlement_id,citizen_type,given_name,surname,name,nameset_id,culture_id,religion_id,education_level_id,sex,status,born_on_turn_number,parent_a_citizen_id,parent_b_citizen_id,user_id,profile_photo_url,role_type,role_nation_id,role_settlement_id,death_cause,death_cause_category,created_at,updated_at";

type CitizenCultureReligionRow = {
  readonly culture_id: string | null;
  readonly religion_id: string | null;
};

const CITIZEN_CULTURE_RELIGION_SELECT = "culture_id,religion_id";

const CITIZEN_AGGREGATE_SELECT =
  "id,citizen_type,status,citizen_assignments(assignment_type)";

export function citizensInSettlementQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CitizenListQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCitizensInSettlement(client, settlementId),
    queryKey: citizensQueryKeys.settlementList(settlementId),
  });
}

export function citizenByIdQueryOptions(
  citizenId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CitizenDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCitizenById(client, citizenId),
    queryKey: citizensQueryKeys.detail(citizenId),
  });
}

export function unpairedAliveCitizensInWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UnpairedAliveInWorldQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getUnpairedAliveCitizensInWorld(client, worldId),
    queryKey: citizensQueryKeys.unpairedAliveInWorld(worldId),
  });
}

export function citizensInWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CitizensInWorldQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCitizensInWorld(client, worldId),
    queryKey: citizensQueryKeys.worldList(worldId),
  });
}

type CitizensByIdsQueryKey = ReturnType<typeof citizensQueryKeys.byIds>;
type CitizensByIdsQueryOptions = UseQueryOptions<
  readonly Citizen[],
  AuthUiError,
  readonly Citizen[],
  CitizensByIdsQueryKey
>;

// Batch-resolve a set of citizen ids to names/links in one round trip — for
// entity references embedded in payload JSON (e.g. partnership log entries)
// rather than the citizen's own row, which loading every citizen in the
// world would not scale to.
export function citizensByIdsQueryOptions(
  ids: readonly string[],
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CitizensByIdsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCitizensByIds(client, ids),
    queryKey: citizensQueryKeys.byIds(ids),
    enabled: ids.length > 0,
  });
}

async function getCitizensInWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly Citizen[]> {
  const { data, error } = await client
    .from("citizens")
    .select(CITIZEN_SELECT)
    .eq("world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<CitizenRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toCitizen);
}

async function getCitizensByIds(
  client: GubernatorSupabaseClient,
  ids: readonly string[],
): Promise<readonly Citizen[]> {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("citizens")
    .select(CITIZEN_SELECT)
    .in("id", ids)
    .returns<CitizenRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toCitizen);
}

export function playerCharactersInNationQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): PlayerCharactersInNationQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getPlayerCharactersInNation(client, nationId),
    queryKey: citizensQueryKeys.playerCharactersInNation(nationId),
  });
}

// Current settlement-manager holders for a nation (#1160): scoped by
// settlement count, not citizen count, so it stays small even in a
// ~1000-NPC world -- unlike the removed full-candidate-list fetch it
// replaces alongside the searchable CitizenPicker.
export function settlementManagersInNationQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementManagersInNationQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementManagersInNation(client, nationId),
    queryKey: citizensQueryKeys.settlementManagersInNation(nationId),
  });
}

export function citizenAdminDetailsQueryOptions(
  citizenId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CitizenAdminDetailsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCitizenAdminDetails(client, citizenId),
    queryKey: citizensQueryKeys.adminDetails(citizenId),
  });
}

export function citizenAggregateStatsForSettlementQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CitizenSettlementAggregateQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCitizenAggregateStatsForSettlement(client, settlementId),
    queryKey: citizensQueryKeys.settlementAggregateStats(settlementId),
  });
}

export function citizenAggregateStatsForNationQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CitizenNationAggregateQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCitizenAggregateStatsForNation(client, nationId),
    queryKey: citizensQueryKeys.nationAggregateStats(nationId),
  });
}

export function cultureReligionCompositionForSettlementQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CitizenSettlementCultureReligionCompositionQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () =>
      getCultureReligionCompositionForSettlement(client, settlementId),
    queryKey:
      citizensQueryKeys.settlementCultureReligionComposition(settlementId),
  });
}

export function cultureReligionCompositionForNationQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CitizenNationCultureReligionCompositionQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCultureReligionCompositionForNation(client, nationId),
    queryKey: citizensQueryKeys.nationCultureReligionComposition(nationId),
  });
}

async function getCitizensInSettlement(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly Citizen[]> {
  const { data, error } = await client
    .from("citizens")
    .select(CITIZEN_SELECT)
    .eq("settlement_id", settlementId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<CitizenRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toCitizen);
}

async function getCitizenById(
  client: GubernatorSupabaseClient,
  citizenId: string,
): Promise<Citizen | null> {
  const { data, error } = await client
    .from("citizens")
    .select(CITIZEN_SELECT)
    .eq("id", citizenId)
    .maybeSingle<CitizenRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toCitizen(data);
}

type PartnershipPairRow = {
  readonly citizen_a_id: string;
  readonly citizen_b_id: string;
};

async function getUnpairedAliveCitizensInWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly Citizen[]> {
  const { data: citizenRows, error: citizensError } = await client
    .from("citizens")
    .select(CITIZEN_SELECT)
    .eq("world_id", worldId)
    .eq("status", "alive")
    .order("name", { ascending: true })
    .returns<CitizenRow[]>();

  if (citizensError !== null) {
    throw normalizeSupabaseError(citizensError);
  }

  if (citizenRows.length === 0) {
    return [];
  }

  const citizenIds = citizenRows.map((row) => row.id);

  // Active partnerships place each partner on a different column, so we run
  // the two single-column lookups in parallel and merge their results — same
  // shape as partnershipsForCitizen but scoped to the world's citizens.
  const [aSide, bSide] = await Promise.all([
    client
      .from("partnerships")
      .select("citizen_a_id,citizen_b_id")
      .eq("status", "active")
      .in("citizen_a_id", citizenIds)
      .returns<PartnershipPairRow[]>(),
    client
      .from("partnerships")
      .select("citizen_a_id,citizen_b_id")
      .eq("status", "active")
      .in("citizen_b_id", citizenIds)
      .returns<PartnershipPairRow[]>(),
  ]);

  if (aSide.error !== null) {
    throw normalizeSupabaseError(aSide.error);
  }
  if (bSide.error !== null) {
    throw normalizeSupabaseError(bSide.error);
  }

  const partneredIds = new Set<string>();
  for (const row of aSide.data) {
    partneredIds.add(row.citizen_a_id);
    partneredIds.add(row.citizen_b_id);
  }
  for (const row of bSide.data) {
    partneredIds.add(row.citizen_a_id);
    partneredIds.add(row.citizen_b_id);
  }

  return citizenRows.filter((row) => !partneredIds.has(row.id)).map(toCitizen);
}

async function getPlayerCharactersInNation(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly Citizen[]> {
  const { data: settlements, error: settlementsError } = await client
    .from("settlements")
    .select("id")
    .eq("nation_id", nationId)
    .returns<Array<{ readonly id: string }>>();

  if (settlementsError !== null) {
    throw normalizeSupabaseError(settlementsError);
  }

  const settlementIds = settlements.map(
    (row: { readonly id: string }) => row.id,
  );

  if (settlementIds.length === 0) {
    return [];
  }

  // Any citizen can hold a manager role (Epic 11): player characters
  // unconditionally, and NPCs while alive (a dead NPC cannot be assigned a
  // role, mirroring assign_citizen_role's guard).
  const { data, error } = await client
    .from("citizens")
    .select(CITIZEN_SELECT)
    .in("settlement_id", settlementIds)
    .or(
      "citizen_type.eq.player_character,and(citizen_type.eq.npc,status.eq.alive)",
    )
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<CitizenRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toCitizen);
}

async function getSettlementManagersInNation(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly Citizen[]> {
  const { data: settlements, error: settlementsError } = await client
    .from("settlements")
    .select("id")
    .eq("nation_id", nationId)
    .returns<Array<{ readonly id: string }>>();

  if (settlementsError !== null) {
    throw normalizeSupabaseError(settlementsError);
  }

  const settlementIds = settlements.map(
    (row: { readonly id: string }) => row.id,
  );

  if (settlementIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("citizens")
    .select(CITIZEN_SELECT)
    .in("settlement_id", settlementIds)
    .eq("role_type", "settlement_manager")
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<CitizenRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toCitizen);
}

async function getCitizenAggregateStatsForSettlement(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<CitizenAggregateStats> {
  const { data, error } = await client
    .from("citizens")
    .select(CITIZEN_AGGREGATE_SELECT)
    .eq("settlement_id", settlementId)
    .returns<CitizenAggregateWithAssignmentRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return computeAggregate(data);
}

async function getCitizenAggregateStatsForNation(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<CitizenAggregateStats> {
  const { data: settlements, error: settlementsError } = await client
    .from("settlements")
    .select("id")
    .eq("nation_id", nationId)
    .returns<Array<{ readonly id: string }>>();

  if (settlementsError !== null) {
    throw normalizeSupabaseError(settlementsError);
  }

  const settlementIds = settlements.map(
    (row: { readonly id: string }) => row.id,
  );

  if (settlementIds.length === 0) {
    return emptyAggregateStats();
  }

  const { data, error } = await client
    .from("citizens")
    .select(CITIZEN_AGGREGATE_SELECT)
    .in("settlement_id", settlementIds)
    .returns<CitizenAggregateWithAssignmentRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return computeAggregate(data);
}

async function getCultureReligionCompositionForSettlement(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<CultureReligionComposition> {
  const { data, error } = await client
    .from("citizens")
    .select(CITIZEN_CULTURE_RELIGION_SELECT)
    .eq("settlement_id", settlementId)
    .eq("status", "alive")
    .returns<CitizenCultureReligionRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return computeCultureReligionComposition(data);
}

async function getCultureReligionCompositionForNation(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<CultureReligionComposition> {
  const { data: settlements, error: settlementsError } = await client
    .from("settlements")
    .select("id")
    .eq("nation_id", nationId)
    .returns<Array<{ readonly id: string }>>();

  if (settlementsError !== null) {
    throw normalizeSupabaseError(settlementsError);
  }

  const settlementIds = settlements.map(
    (row: { readonly id: string }) => row.id,
  );

  if (settlementIds.length === 0) {
    return { byCultureId: {}, byReligionId: {} };
  }

  const { data, error } = await client
    .from("citizens")
    .select(CITIZEN_CULTURE_RELIGION_SELECT)
    .in("settlement_id", settlementIds)
    .eq("status", "alive")
    .returns<CitizenCultureReligionRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return computeCultureReligionComposition(data);
}

function computeCultureReligionComposition(
  rows: readonly CitizenCultureReligionRow[],
): CultureReligionComposition {
  const byCultureId: Record<string, number> = {};
  const byReligionId: Record<string, number> = {};

  for (const row of rows) {
    const cultureKey = row.culture_id ?? UNASSIGNED_CULTURE_RELIGION_KEY;
    byCultureId[cultureKey] = (byCultureId[cultureKey] ?? 0) + 1;
    const religionKey = row.religion_id ?? UNASSIGNED_CULTURE_RELIGION_KEY;
    byReligionId[religionKey] = (byReligionId[religionKey] ?? 0) + 1;
  }

  return { byCultureId, byReligionId };
}

function computeAggregate(
  rows: readonly CitizenAggregateWithAssignmentRow[],
): CitizenAggregateStats {
  const typeBreakdown: Record<CitizenType, number> = {
    npc: 0,
    player_character: 0,
  };
  const statusBreakdown: Record<CitizenStatus, number> = {
    alive: 0,
    dead: 0,
  };
  const assignmentTypeBreakdown: Record<
    CitizenAssignmentType | "unassigned",
    number
  > = {
    construction_project: 0,
    culling: 0,
    deposit: 0,
    husbandry: 0,
    standard_job: 0,
    trade_route: 0,
    unassigned: 0,
  };
  let unassignedNpcCount = 0;
  let unassignedPcCount = 0;

  for (const row of rows) {
    typeBreakdown[row.citizen_type] += 1;
    statusBreakdown[row.status] += 1;
    const assignment = row.citizen_assignments?.assignment_type ?? null;
    if (assignment === null) {
      if (row.status === "alive") {
        assignmentTypeBreakdown.unassigned += 1;
        if (row.citizen_type === "npc") {
          unassignedNpcCount += 1;
        } else {
          unassignedPcCount += 1;
        }
      }
    } else {
      assignmentTypeBreakdown[assignment] += 1;
    }
  }

  return {
    assignmentTypeBreakdown,
    statusBreakdown,
    total: rows.length,
    typeBreakdown,
    unassignedNpcCount,
    unassignedPcCount,
  };
}

function emptyAggregateStats(): CitizenAggregateStats {
  return {
    assignmentTypeBreakdown: {
      construction_project: 0,
      culling: 0,
      deposit: 0,
      husbandry: 0,
      standard_job: 0,
      trade_route: 0,
      unassigned: 0,
    },
    statusBreakdown: { alive: 0, dead: 0 },
    total: 0,
    typeBreakdown: { npc: 0, player_character: 0 },
    unassignedNpcCount: 0,
    unassignedPcCount: 0,
  };
}

async function getCitizenAdminDetails(
  client: GubernatorSupabaseClient,
  citizenId: string,
): Promise<CitizenAdminDetails | null> {
  const { data, error } = await client
    .rpc("get_citizen_admin_details", { p_citizen_id: citizenId })
    .maybeSingle<CitizenAdminDetailsRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    return null;
  }

  return {
    npcFlaw: data.npc_flaw,
    npcGoal: data.npc_goal,
    npcSecretContradiction: data.npc_secret_contradiction,
    npcTrait1: data.npc_trait_1,
    npcTrait2: data.npc_trait_2,
    personalityText: data.personality_text,
    skillsText: data.skills_text,
  };
}

export function toCitizen(row: CitizenRow): Citizen {
  return {
    bornOnTurnNumber: row.born_on_turn_number,
    citizenType: row.citizen_type,
    createdAt: row.created_at,
    cultureId: row.culture_id,
    deathCause: row.death_cause,
    deathCauseCategory: row.death_cause_category,
    educationLevelId: row.education_level_id,
    givenName: row.given_name,
    id: row.id,
    name: row.name,
    namesetId: row.nameset_id,
    parentACitizenId: row.parent_a_citizen_id,
    parentBCitizenId: row.parent_b_citizen_id,
    profilePhotoUrl: row.profile_photo_url,
    religionId: row.religion_id,
    roleNationId: row.role_nation_id,
    roleSettlementId: row.role_settlement_id,
    roleType: row.role_type,
    settlementId: row.settlement_id,
    sex: row.sex,
    status: row.status,
    surname: row.surname,
    updatedAt: row.updated_at,
    userId: row.user_id,
    worldId: row.world_id,
  };
}

export type { CitizenRow };
