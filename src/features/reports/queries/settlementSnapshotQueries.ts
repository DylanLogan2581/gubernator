import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { settlementSnapshotQueryKeys } from "./settlementSnapshotQueryKeys";

import type {
  PopulationSnapshotRow,
  ResourceSnapshotRow,
} from "../types/snapshotTypes";

type PopulationSnapshotsQueryKey = ReturnType<
  typeof settlementSnapshotQueryKeys.population
>;
type PopulationSnapshotsQueryOptions = UseQueryOptions<
  readonly PopulationSnapshotRow[],
  AuthUiError,
  readonly PopulationSnapshotRow[],
  PopulationSnapshotsQueryKey
>;
type ResourceSnapshotsQueryKey = ReturnType<
  typeof settlementSnapshotQueryKeys.resources
>;
type ResourceSnapshotsQueryOptions = UseQueryOptions<
  readonly ResourceSnapshotRow[],
  AuthUiError,
  readonly ResourceSnapshotRow[],
  ResourceSnapshotsQueryKey
>;

const POPULATION_SNAPSHOT_SELECT =
  "turn_number,population_total,population_npc,population_player_character,population_cap,birth_count,death_count,starvation_deaths_count,homeless_deaths_count";

const RESOURCE_SNAPSHOT_SELECT =
  "turn_number,resource_id,quantity_before,quantity_after,produced_amount,consumed_amount,trade_in_amount,trade_out_amount,resources!inner(name)";

export function settlementPopulationSnapshotsQueryOptions(
  settlementId: string,
  fromTurn: number,
  toTurn: number,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): PopulationSnapshotsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () =>
      getPopulationSnapshots(client, settlementId, fromTurn, toTurn),
    queryKey: settlementSnapshotQueryKeys.population(
      settlementId,
      fromTurn,
      toTurn,
    ),
  });
}

export function settlementResourceSnapshotsQueryOptions(
  settlementId: string,
  fromTurn: number,
  toTurn: number,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ResourceSnapshotsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getResourceSnapshots(client, settlementId, fromTurn, toTurn),
    queryKey: settlementSnapshotQueryKeys.resources(
      settlementId,
      fromTurn,
      toTurn,
    ),
  });
}

type PopulationSnapshotDbRow = {
  readonly turn_number: number;
  readonly population_total: number;
  readonly population_npc: number;
  readonly population_player_character: number;
  readonly population_cap: number;
  readonly birth_count: number;
  readonly death_count: number;
  readonly starvation_deaths_count: number;
  readonly homeless_deaths_count: number;
};

async function getPopulationSnapshots(
  client: GubernatorSupabaseClient,
  settlementId: string,
  fromTurn: number,
  toTurn: number,
): Promise<readonly PopulationSnapshotRow[]> {
  const { data, error } = await client
    .from("settlement_turn_snapshots")
    .select(POPULATION_SNAPSHOT_SELECT)
    .eq("settlement_id", settlementId)
    .gte("turn_number", fromTurn)
    .lte("turn_number", toTurn)
    .order("turn_number", { ascending: true })
    .returns<PopulationSnapshotDbRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}

type ResourceSnapshotDbRow = {
  readonly turn_number: number;
  readonly resource_id: string;
  readonly quantity_before: number;
  readonly quantity_after: number;
  readonly produced_amount: number;
  readonly consumed_amount: number;
  readonly trade_in_amount: number;
  readonly trade_out_amount: number;
  readonly resources: { readonly name: string };
};

async function getResourceSnapshots(
  client: GubernatorSupabaseClient,
  settlementId: string,
  fromTurn: number,
  toTurn: number,
): Promise<readonly ResourceSnapshotRow[]> {
  const { data, error } = await client
    .from("settlement_turn_resource_snapshots")
    .select(RESOURCE_SNAPSHOT_SELECT)
    .eq("settlement_id", settlementId)
    .gte("turn_number", fromTurn)
    .lte("turn_number", toTurn)
    .order("turn_number", { ascending: true })
    .returns<ResourceSnapshotDbRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map((row) => ({
    consumed_amount: row.consumed_amount,
    produced_amount: row.produced_amount,
    quantity_after: row.quantity_after,
    quantity_before: row.quantity_before,
    resource_id: row.resource_id,
    resource_name: row.resources.name,
    trade_in_amount: row.trade_in_amount,
    trade_out_amount: row.trade_out_amount,
    turn_number: row.turn_number,
  }));
}
