import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { settlementsQueryKeys } from "./settlementsQueryKeys";

import type {
  SettlementSummary,
  SettlementWithNation,
} from "../types/settlementTypes";

type SettlementDetailQueryKey = ReturnType<typeof settlementsQueryKeys.detail>;
type SettlementDetailQueryOptions = UseQueryOptions<
  SettlementWithNation | null,
  AuthUiError,
  SettlementWithNation | null,
  SettlementDetailQueryKey
>;

type SettlementWithNationRow = {
  readonly coord_x: number | null;
  readonly coord_z: number | null;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly nameset_id: string | null;
  readonly nation_id: string;
  readonly nations: {
    readonly id: string;
    readonly name: string;
    readonly nameset_id: string | null;
    readonly world_id: string;
  };
  readonly updated_at: string;
};

const SETTLEMENT_WITH_NATION_SELECT =
  "id,nation_id,name,description,nameset_id,coord_x,coord_z,created_at,updated_at,nations!inner(id,name,nameset_id,world_id)";

export function settlementByIdQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementById(client, settlementId),
    queryKey: settlementsQueryKeys.detail(settlementId),
  });
}

async function getSettlementById(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<SettlementWithNation | null> {
  const { data, error } = await client
    .from("settlements")
    .select(SETTLEMENT_WITH_NATION_SELECT)
    .eq("id", settlementId)
    .maybeSingle<SettlementWithNationRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toSettlementWithNation(data);
}

type SettlementSummaryRow = {
  readonly id: string;
  readonly name: string;
  readonly nation_id: string;
  readonly nations: { readonly name: string };
};

const SETTLEMENT_SUMMARY_SELECT = "id,nation_id,name,nations!inner(name)";

type SettlementsByWorldQueryKey = ReturnType<
  typeof settlementsQueryKeys.byWorld
>;
type SettlementsByWorldQueryOptions = UseQueryOptions<
  readonly SettlementSummary[],
  AuthUiError,
  readonly SettlementSummary[],
  SettlementsByWorldQueryKey
>;

export function settlementsByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementsByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getSettlementsByWorld(c, worldId),
    queryKey: settlementsQueryKeys.byWorld(worldId),
  });
}

async function getSettlementsByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly SettlementSummary[]> {
  const { data, error } = await client
    .from("settlements")
    .select(SETTLEMENT_SUMMARY_SELECT)
    .eq("nations.world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<SettlementSummaryRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toSettlementSummary);
}

function toSettlementSummary(row: SettlementSummaryRow): SettlementSummary {
  return {
    id: row.id,
    name: row.name,
    nationId: row.nation_id,
    nationName: row.nations.name,
  };
}

function toSettlementWithNation(
  row: SettlementWithNationRow,
): SettlementWithNation {
  return {
    coordX: row.coord_x,
    coordZ: row.coord_z,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    name: row.name,
    namesetId: row.nameset_id,
    nation: {
      id: row.nations.id,
      name: row.nations.name,
      namesetId: row.nations.nameset_id,
      worldId: row.nations.world_id,
    },
    nationId: row.nation_id,
    updatedAt: row.updated_at,
  };
}

type SettlementPopulationCapQueryKey = ReturnType<
  typeof settlementsQueryKeys.populationCap
>;
type SettlementPopulationCapQueryOptions = UseQueryOptions<
  number,
  AuthUiError,
  number,
  SettlementPopulationCapQueryKey
>;

export function settlementPopulationCapQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementPopulationCapQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementPopulationCap(client, settlementId),
    queryKey: settlementsQueryKeys.populationCap(settlementId),
  });
}

async function getSettlementPopulationCap(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<number> {
  const { data, error } = await client.rpc("settlement_population_cap", {
    p_settlement_id: settlementId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}
