import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { snapshotAggregateQueryKeys } from "./snapshotAggregateQueryKeys";

import type {
  NationPopulationAggregateRow,
  NationResourceAggregateRow,
  NationSettlementSnapshotRow,
  WorldNationPopulationAggregateRow,
  WorldPopulationAggregateRow,
  WorldResourceAggregateRow,
} from "../types/snapshotTypes";

// ---------------------------------------------------------------------------
// Select strings
// ---------------------------------------------------------------------------

const NATION_POP_AGGREGATE_SELECT =
  "turn_number,population_total,population_npc,population_player_character,population_cap,birth_count,death_count,starvation_deaths_count,homeless_deaths_count";

const NATION_RESOURCE_AGGREGATE_SELECT =
  "turn_number,resource_id,resource_name,produced_amount,consumed_amount,trade_in_amount,trade_out_amount,net_amount";

const NATION_SETTLEMENT_SNAPSHOT_SELECT =
  "settlement_id,turn_number,population_total,population_npc,population_player_character,population_cap,birth_count,death_count,starvation_deaths_count,homeless_deaths_count,settlements!inner(name)";

const WORLD_POP_AGGREGATE_SELECT =
  "turn_number,population_total,population_npc,population_player_character,population_cap,birth_count,death_count,starvation_deaths_count,homeless_deaths_count";

const WORLD_RESOURCE_AGGREGATE_SELECT =
  "turn_number,resource_id,resource_name,produced_amount,consumed_amount,trade_in_amount,trade_out_amount,net_amount";

// ---------------------------------------------------------------------------
// DB row types (nullable because views use SUM / JOIN)
// ---------------------------------------------------------------------------

type NationPopAggDbRow = {
  readonly turn_number: number | null;
  readonly population_total: number | null;
  readonly population_npc: number | null;
  readonly population_player_character: number | null;
  readonly population_cap: number | null;
  readonly birth_count: number | null;
  readonly death_count: number | null;
  readonly starvation_deaths_count: number | null;
  readonly homeless_deaths_count: number | null;
};

type NationResourceAggDbRow = {
  readonly turn_number: number | null;
  readonly resource_id: string | null;
  readonly resource_name: string | null;
  readonly produced_amount: number | null;
  readonly consumed_amount: number | null;
  readonly trade_in_amount: number | null;
  readonly trade_out_amount: number | null;
  readonly net_amount: number | null;
};

type NationSettlementSnapshotDbRow = {
  readonly settlement_id: string;
  readonly turn_number: number;
  readonly population_total: number;
  readonly population_npc: number;
  readonly population_player_character: number;
  readonly population_cap: number;
  readonly birth_count: number;
  readonly death_count: number;
  readonly starvation_deaths_count: number;
  readonly homeless_deaths_count: number;
  readonly settlements: { readonly name: string };
};

type WorldPopAggDbRow = {
  readonly turn_number: number | null;
  readonly population_total: number | null;
  readonly population_npc: number | null;
  readonly population_player_character: number | null;
  readonly population_cap: number | null;
  readonly birth_count: number | null;
  readonly death_count: number | null;
  readonly starvation_deaths_count: number | null;
  readonly homeless_deaths_count: number | null;
};

type WorldResourceAggDbRow = {
  readonly turn_number: number | null;
  readonly resource_id: string | null;
  readonly resource_name: string | null;
  readonly produced_amount: number | null;
  readonly consumed_amount: number | null;
  readonly trade_in_amount: number | null;
  readonly trade_out_amount: number | null;
  readonly net_amount: number | null;
};

// ---------------------------------------------------------------------------
// Query option types
// ---------------------------------------------------------------------------

type NationPopAggQueryKey = ReturnType<
  typeof snapshotAggregateQueryKeys.nationPopulation
>;
type NationPopAggQueryOptions = UseQueryOptions<
  readonly NationPopulationAggregateRow[],
  AuthUiError,
  readonly NationPopulationAggregateRow[],
  NationPopAggQueryKey
>;

type NationResourceAggQueryKey = ReturnType<
  typeof snapshotAggregateQueryKeys.nationResources
>;
type NationResourceAggQueryOptions = UseQueryOptions<
  readonly NationResourceAggregateRow[],
  AuthUiError,
  readonly NationResourceAggregateRow[],
  NationResourceAggQueryKey
>;

type NationSettlementSnapshotsQueryKey = ReturnType<
  typeof snapshotAggregateQueryKeys.nationSettlements
>;
type NationSettlementSnapshotsQueryOptions = UseQueryOptions<
  readonly NationSettlementSnapshotRow[],
  AuthUiError,
  readonly NationSettlementSnapshotRow[],
  NationSettlementSnapshotsQueryKey
>;

type WorldPopAggQueryKey = ReturnType<
  typeof snapshotAggregateQueryKeys.worldPopulation
>;
type WorldPopAggQueryOptions = UseQueryOptions<
  readonly WorldPopulationAggregateRow[],
  AuthUiError,
  readonly WorldPopulationAggregateRow[],
  WorldPopAggQueryKey
>;

type WorldResourceAggQueryKey = ReturnType<
  typeof snapshotAggregateQueryKeys.worldResources
>;
type WorldResourceAggQueryOptions = UseQueryOptions<
  readonly WorldResourceAggregateRow[],
  AuthUiError,
  readonly WorldResourceAggregateRow[],
  WorldResourceAggQueryKey
>;

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

async function getNationPopulationAggregates(
  client: GubernatorSupabaseClient,
  nationId: string,
  fromTurn: number,
  toTurn: number,
): Promise<readonly NationPopulationAggregateRow[]> {
  const { data, error } = await client
    .from("nation_turn_population_aggregates")
    .select(NATION_POP_AGGREGATE_SELECT)
    .eq("nation_id", nationId)
    .gte("turn_number", fromTurn)
    .lte("turn_number", toTurn)
    .order("turn_number", { ascending: true })
    .returns<NationPopAggDbRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data
    .filter(
      (
        row,
      ): row is NationPopAggDbRow & {
        turn_number: number;
        population_total: number;
      } => row.turn_number !== null && row.population_total !== null,
    )
    .map((row) => ({
      birth_count: row.birth_count ?? 0,
      death_count: row.death_count ?? 0,
      homeless_deaths_count: row.homeless_deaths_count ?? 0,
      population_cap: row.population_cap ?? 0,
      population_npc: row.population_npc ?? 0,
      population_player_character: row.population_player_character ?? 0,
      population_total: row.population_total,
      starvation_deaths_count: row.starvation_deaths_count ?? 0,
      turn_number: row.turn_number,
    }));
}

async function getNationResourceAggregates(
  client: GubernatorSupabaseClient,
  nationId: string,
  fromTurn: number,
  toTurn: number,
): Promise<readonly NationResourceAggregateRow[]> {
  const { data, error } = await client
    .from("nation_turn_resource_aggregates")
    .select(NATION_RESOURCE_AGGREGATE_SELECT)
    .eq("nation_id", nationId)
    .gte("turn_number", fromTurn)
    .lte("turn_number", toTurn)
    .order("turn_number", { ascending: true })
    .returns<NationResourceAggDbRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data
    .filter(
      (
        row,
      ): row is NationResourceAggDbRow & {
        turn_number: number;
        resource_id: string;
        resource_name: string;
      } =>
        row.turn_number !== null &&
        row.resource_id !== null &&
        row.resource_name !== null,
    )
    .map((row) => ({
      consumed_amount: row.consumed_amount ?? 0,
      net_amount: row.net_amount ?? 0,
      produced_amount: row.produced_amount ?? 0,
      resource_id: row.resource_id,
      resource_name: row.resource_name,
      trade_in_amount: row.trade_in_amount ?? 0,
      trade_out_amount: row.trade_out_amount ?? 0,
      turn_number: row.turn_number,
    }));
}

async function getNationSettlementSnapshots(
  client: GubernatorSupabaseClient,
  nationId: string,
  fromTurn: number,
  toTurn: number,
): Promise<readonly NationSettlementSnapshotRow[]> {
  const { data, error } = await client
    .from("settlement_turn_snapshots")
    .select(NATION_SETTLEMENT_SNAPSHOT_SELECT)
    .eq("settlements.nation_id", nationId)
    .gte("turn_number", fromTurn)
    .lte("turn_number", toTurn)
    .order("turn_number", { ascending: true })
    .returns<NationSettlementSnapshotDbRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map((row) => ({
    birth_count: row.birth_count,
    death_count: row.death_count,
    homeless_deaths_count: row.homeless_deaths_count,
    population_cap: row.population_cap,
    population_npc: row.population_npc,
    population_player_character: row.population_player_character,
    population_total: row.population_total,
    settlement_id: row.settlement_id,
    settlement_name: row.settlements.name,
    starvation_deaths_count: row.starvation_deaths_count,
    turn_number: row.turn_number,
  }));
}

async function getWorldPopulationAggregates(
  client: GubernatorSupabaseClient,
  worldId: string,
  fromTurn: number,
  toTurn: number,
): Promise<readonly WorldPopulationAggregateRow[]> {
  const { data, error } = await client
    .from("world_turn_population_aggregates")
    .select(WORLD_POP_AGGREGATE_SELECT)
    .eq("world_id", worldId)
    .gte("turn_number", fromTurn)
    .lte("turn_number", toTurn)
    .order("turn_number", { ascending: true })
    .returns<WorldPopAggDbRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data
    .filter(
      (
        row,
      ): row is WorldPopAggDbRow & {
        turn_number: number;
        population_total: number;
      } => row.turn_number !== null && row.population_total !== null,
    )
    .map((row) => ({
      birth_count: row.birth_count ?? 0,
      death_count: row.death_count ?? 0,
      homeless_deaths_count: row.homeless_deaths_count ?? 0,
      population_cap: row.population_cap ?? 0,
      population_npc: row.population_npc ?? 0,
      population_player_character: row.population_player_character ?? 0,
      population_total: row.population_total,
      starvation_deaths_count: row.starvation_deaths_count ?? 0,
      turn_number: row.turn_number,
    }));
}

async function getWorldResourceAggregates(
  client: GubernatorSupabaseClient,
  worldId: string,
  fromTurn: number,
  toTurn: number,
): Promise<readonly WorldResourceAggregateRow[]> {
  const { data, error } = await client
    .from("world_turn_resource_aggregates")
    .select(WORLD_RESOURCE_AGGREGATE_SELECT)
    .eq("world_id", worldId)
    .gte("turn_number", fromTurn)
    .lte("turn_number", toTurn)
    .order("turn_number", { ascending: true })
    .returns<WorldResourceAggDbRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data
    .filter(
      (
        row,
      ): row is WorldResourceAggDbRow & {
        turn_number: number;
        resource_id: string;
        resource_name: string;
      } =>
        row.turn_number !== null &&
        row.resource_id !== null &&
        row.resource_name !== null,
    )
    .map((row) => ({
      consumed_amount: row.consumed_amount ?? 0,
      net_amount: row.net_amount ?? 0,
      produced_amount: row.produced_amount ?? 0,
      resource_id: row.resource_id,
      resource_name: row.resource_name,
      trade_in_amount: row.trade_in_amount ?? 0,
      trade_out_amount: row.trade_out_amount ?? 0,
      turn_number: row.turn_number,
    }));
}

// ---------------------------------------------------------------------------
// Exported query options
// ---------------------------------------------------------------------------

export function nationPopulationAggregatesQueryOptions(
  nationId: string,
  fromTurn: number,
  toTurn: number,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationPopAggQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () =>
      getNationPopulationAggregates(client, nationId, fromTurn, toTurn),
    queryKey: snapshotAggregateQueryKeys.nationPopulation(
      nationId,
      fromTurn,
      toTurn,
    ),
  });
}

export function nationResourceAggregatesQueryOptions(
  nationId: string,
  fromTurn: number,
  toTurn: number,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationResourceAggQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () =>
      getNationResourceAggregates(client, nationId, fromTurn, toTurn),
    queryKey: snapshotAggregateQueryKeys.nationResources(
      nationId,
      fromTurn,
      toTurn,
    ),
  });
}

export function nationSettlementSnapshotsQueryOptions(
  nationId: string,
  fromTurn: number,
  toTurn: number,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationSettlementSnapshotsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () =>
      getNationSettlementSnapshots(client, nationId, fromTurn, toTurn),
    queryKey: snapshotAggregateQueryKeys.nationSettlements(
      nationId,
      fromTurn,
      toTurn,
    ),
  });
}

export function worldPopulationAggregatesQueryOptions(
  worldId: string,
  fromTurn: number,
  toTurn: number,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldPopAggQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () =>
      getWorldPopulationAggregates(client, worldId, fromTurn, toTurn),
    queryKey: snapshotAggregateQueryKeys.worldPopulation(
      worldId,
      fromTurn,
      toTurn,
    ),
  });
}

export function worldResourceAggregatesQueryOptions(
  worldId: string,
  fromTurn: number,
  toTurn: number,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldResourceAggQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () =>
      getWorldResourceAggregates(client, worldId, fromTurn, toTurn),
    queryKey: snapshotAggregateQueryKeys.worldResources(
      worldId,
      fromTurn,
      toTurn,
    ),
  });
}

// ---------------------------------------------------------------------------
// World-scoped per-nation population query (for nation comparison table)
// ---------------------------------------------------------------------------

const WORLD_NATION_POP_AGGREGATE_SELECT =
  "nation_id,turn_number,population_total,population_npc,population_player_character,population_cap,birth_count,death_count,starvation_deaths_count,homeless_deaths_count";

type WorldNationPopAggDbRow = NationPopAggDbRow & {
  readonly nation_id: string | null;
};

type WorldNationPopAggQueryKey = ReturnType<
  typeof snapshotAggregateQueryKeys.worldNationsPopulation
>;
type WorldNationPopAggQueryOptions = UseQueryOptions<
  readonly WorldNationPopulationAggregateRow[],
  AuthUiError,
  readonly WorldNationPopulationAggregateRow[],
  WorldNationPopAggQueryKey
>;

async function getWorldNationsPopulationAggregates(
  client: GubernatorSupabaseClient,
  worldId: string,
  fromTurn: number,
  toTurn: number,
): Promise<readonly WorldNationPopulationAggregateRow[]> {
  const { data, error } = await client
    .from("nation_turn_population_aggregates")
    .select(WORLD_NATION_POP_AGGREGATE_SELECT)
    .eq("world_id", worldId)
    .gte("turn_number", fromTurn)
    .lte("turn_number", toTurn)
    .order("turn_number", { ascending: true })
    .returns<WorldNationPopAggDbRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data
    .filter(
      (
        row,
      ): row is WorldNationPopAggDbRow & {
        turn_number: number;
        nation_id: string;
        population_total: number;
      } =>
        row.turn_number !== null &&
        row.nation_id !== null &&
        row.population_total !== null,
    )
    .map((row) => ({
      birth_count: row.birth_count ?? 0,
      death_count: row.death_count ?? 0,
      homeless_deaths_count: row.homeless_deaths_count ?? 0,
      nation_id: row.nation_id,
      population_cap: row.population_cap ?? 0,
      population_npc: row.population_npc ?? 0,
      population_player_character: row.population_player_character ?? 0,
      population_total: row.population_total,
      starvation_deaths_count: row.starvation_deaths_count ?? 0,
      turn_number: row.turn_number,
    }));
}

export function worldNationsPopulationQueryOptions(
  worldId: string,
  fromTurn: number,
  toTurn: number,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldNationPopAggQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () =>
      getWorldNationsPopulationAggregates(client, worldId, fromTurn, toTurn),
    queryKey: snapshotAggregateQueryKeys.worldNationsPopulation(
      worldId,
      fromTurn,
      toTurn,
    ),
  });
}
