import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { armiesQueryKeys } from "./armiesQueryKeys";
import {
  ARMY_GROUP_SELECT,
  ARMY_SELECT,
  ARMY_TURN_SNAPSHOT_SELECT,
  ARMY_UNIT_SELECT,
  toArmy,
  toArmyGroup,
  toArmyTurnSnapshot,
  toArmyUnit,
  toUnitSoldier,
  UNIT_SOLDIER_SELECT,
  type ArmyGroupRow,
  type ArmyRow,
  type ArmyTurnSnapshotRow,
  type ArmyUnitRow,
  type UnitSoldierRow,
} from "./armyRows";

import type {
  Army,
  ArmyGroup,
  ArmyTurnSnapshot,
  ArmyUnit,
  UnitSoldier,
} from "../types/armyTypes";

type ArmiesByNationQueryKey = ReturnType<typeof armiesQueryKeys.byNation>;
type ArmiesByNationQueryOptions = UseQueryOptions<
  readonly Army[],
  AuthUiError,
  readonly Army[],
  ArmiesByNationQueryKey
>;

export function armiesByNationQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ArmiesByNationQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getArmiesByNation(c, nationId),
    queryKey: armiesQueryKeys.byNation(nationId),
  });
}

async function getArmiesByNation(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly Army[]> {
  const { data, error } = await client
    .from("armies")
    .select(ARMY_SELECT)
    .eq("nation_id", nationId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<ArmyRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toArmy);
}

type ArmyGroupsByArmyQueryKey = ReturnType<typeof armiesQueryKeys.groupsByArmy>;
type ArmyGroupsByArmyQueryOptions = UseQueryOptions<
  readonly ArmyGroup[],
  AuthUiError,
  readonly ArmyGroup[],
  ArmyGroupsByArmyQueryKey
>;

export function armyGroupsByArmyQueryOptions(
  armyId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ArmyGroupsByArmyQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getArmyGroupsByArmy(c, armyId),
    queryKey: armiesQueryKeys.groupsByArmy(armyId),
  });
}

async function getArmyGroupsByArmy(
  client: GubernatorSupabaseClient,
  armyId: string,
): Promise<readonly ArmyGroup[]> {
  const { data, error } = await client
    .from("army_groups")
    .select(ARMY_GROUP_SELECT)
    .eq("army_id", armyId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<ArmyGroupRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toArmyGroup);
}

type ArmyUnitsByArmyQueryKey = ReturnType<typeof armiesQueryKeys.unitsByArmy>;
type ArmyUnitsByArmyQueryOptions = UseQueryOptions<
  readonly ArmyUnit[],
  AuthUiError,
  readonly ArmyUnit[],
  ArmyUnitsByArmyQueryKey
>;

export function armyUnitsByArmyQueryOptions(
  armyId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ArmyUnitsByArmyQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getArmyUnitsByArmy(c, armyId),
    queryKey: armiesQueryKeys.unitsByArmy(armyId),
  });
}

async function getArmyUnitsByArmy(
  client: GubernatorSupabaseClient,
  armyId: string,
): Promise<readonly ArmyUnit[]> {
  const { data, error } = await client
    .from("army_units")
    .select(ARMY_UNIT_SELECT)
    .eq("army_id", armyId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<ArmyUnitRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toArmyUnit);
}

type SoldiersByUnitQueryKey = ReturnType<typeof armiesQueryKeys.soldiersByUnit>;
type SoldiersByUnitQueryOptions = UseQueryOptions<
  readonly UnitSoldier[],
  AuthUiError,
  readonly UnitSoldier[],
  SoldiersByUnitQueryKey
>;

export function unitSoldiersByUnitQueryOptions(
  unitId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SoldiersByUnitQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getUnitSoldiersByUnit(c, unitId),
    queryKey: armiesQueryKeys.soldiersByUnit(unitId),
  });
}

async function getUnitSoldiersByUnit(
  client: GubernatorSupabaseClient,
  unitId: string,
): Promise<readonly UnitSoldier[]> {
  const { data, error } = await client
    .from("unit_soldiers")
    .select(UNIT_SOLDIER_SELECT)
    .eq("unit_id", unitId)
    .returns<UnitSoldierRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toUnitSoldier);
}

type SoldierCitizenIdsByWorldQueryKey = ReturnType<
  typeof armiesQueryKeys.soldierCitizenIdsByWorld
>;
type SoldierCitizenIdsByWorldQueryOptions = UseQueryOptions<
  ReadonlySet<string>,
  AuthUiError,
  ReadonlySet<string>,
  SoldierCitizenIdsByWorldQueryKey
>;

export function soldierCitizenIdsByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SoldierCitizenIdsByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getSoldierCitizenIdsByWorld(c, worldId),
    queryKey: armiesQueryKeys.soldierCitizenIdsByWorld(worldId),
  });
}

async function getSoldierCitizenIdsByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<ReadonlySet<string>> {
  const { data, error } = await client
    .from("unit_soldiers")
    .select("citizen_id")
    .eq("world_id", worldId)
    .returns<{ readonly citizen_id: string }[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return new Set(data.map((row) => row.citizen_id));
}

type SoldierCountsByArmyIdsQueryKey = ReturnType<
  typeof armiesQueryKeys.soldierCountsByArmyIds
>;
type SoldierCountsByArmyIdsQueryOptions = UseQueryOptions<
  Readonly<Record<string, number>>,
  AuthUiError,
  Readonly<Record<string, number>>,
  SoldierCountsByArmyIdsQueryKey
>;

// One aggregate query for the army list — sums unit_soldiers per army via the
// army_units join, so the list view doesn't need every unit's tree expanded
// to show a total headcount.
export function armySoldierCountsQueryOptions(
  armyIds: readonly string[],
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SoldierCountsByArmyIdsQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getArmySoldierCounts(c, armyIds),
    queryKey: armiesQueryKeys.soldierCountsByArmyIds(armyIds),
  });
}

async function getArmySoldierCounts(
  client: GubernatorSupabaseClient,
  armyIds: readonly string[],
): Promise<Readonly<Record<string, number>>> {
  if (armyIds.length === 0) {
    return {};
  }

  const { data, error } = await client
    .from("army_units")
    .select("army_id,unit_soldiers(count)")
    .in("army_id", armyIds)
    .returns<
      {
        readonly army_id: string;
        readonly unit_soldiers: { count: number }[];
      }[]
    >();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  const counts: Record<string, number> = {};
  for (const row of data) {
    const unitCount = row.unit_soldiers[0]?.count ?? 0;
    counts[row.army_id] = (counts[row.army_id] ?? 0) + unitCount;
  }
  return counts;
}

type LatestSnapshotsByArmyIdsQueryKey = ReturnType<
  typeof armiesQueryKeys.latestSnapshotsByArmyIds
>;
type LatestSnapshotsByArmyIdsQueryOptions = UseQueryOptions<
  Readonly<Record<string, ArmyTurnSnapshot>>,
  AuthUiError,
  Readonly<Record<string, ArmyTurnSnapshot>>,
  LatestSnapshotsByArmyIdsQueryKey
>;

// Latest per-army snapshot (for the "upkeep paid" badge) reduced client-side
// from one ordered query, since there's no per-group "latest" RPC.
export function armyLatestSnapshotsQueryOptions(
  armyIds: readonly string[],
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): LatestSnapshotsByArmyIdsQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getArmyLatestSnapshots(c, armyIds),
    queryKey: armiesQueryKeys.latestSnapshotsByArmyIds(armyIds),
  });
}

async function getArmyLatestSnapshots(
  client: GubernatorSupabaseClient,
  armyIds: readonly string[],
): Promise<Readonly<Record<string, ArmyTurnSnapshot>>> {
  if (armyIds.length === 0) {
    return {};
  }

  const { data, error } = await client
    .from("army_turn_snapshots")
    .select(ARMY_TURN_SNAPSHOT_SELECT)
    .in("army_id", armyIds)
    .order("turn_number", { ascending: false })
    .returns<ArmyTurnSnapshotRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  const latestByArmyId: Record<string, ArmyTurnSnapshot> = {};
  for (const row of data) {
    if (latestByArmyId[row.army_id] === undefined) {
      latestByArmyId[row.army_id] = toArmyTurnSnapshot(row);
    }
  }
  return latestByArmyId;
}
