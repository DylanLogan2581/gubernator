import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationOfficesQueryKeys } from "./nationOfficesQueryKeys";

import type { OfficeType } from "../types/nationOfficeTypes";

const OFFICE_TYPE_SELECT =
  "id,world_id,nation_id,name,description,scope,icon,color,max_holders,excludes_from_labor,default_term_turns";

type OfficeTypeRow = {
  readonly color: string | null;
  readonly default_term_turns: number | null;
  readonly description: string | null;
  readonly excludes_from_labor: boolean;
  readonly icon: string | null;
  readonly id: string;
  readonly max_holders: number | null;
  readonly name: string;
  readonly nation_id: string | null;
  readonly scope: string;
  readonly world_id: string;
};

function toOfficeType(row: OfficeTypeRow): OfficeType {
  return {
    color: row.color,
    defaultTermTurns: row.default_term_turns,
    description: row.description,
    excludesFromLabor: row.excludes_from_labor,
    icon: row.icon,
    id: row.id,
    maxHolders: row.max_holders,
    name: row.name,
    nationId: row.nation_id,
    scope: row.scope as OfficeType["scope"],
    worldId: row.world_id,
  };
}

type NationOfficeTypesQueryKey = ReturnType<
  typeof nationOfficesQueryKeys.officeTypes
>;
type NationOfficeTypesQueryOptions = UseQueryOptions<
  readonly OfficeType[],
  AuthUiError,
  readonly OfficeType[],
  NationOfficeTypesQueryKey
>;

// World-default office types (nation_id null) plus this nation's own custom
// office types -- the full set of offices a nation manager may appoint into
// or manage from the nation's government tab.
export function nationOfficeTypesQueryOptions(
  worldId: string,
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationOfficeTypesQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationOfficeTypes(client, worldId, nationId),
    queryKey: nationOfficesQueryKeys.officeTypes(worldId, nationId),
  });
}

async function getNationOfficeTypes(
  client: GubernatorSupabaseClient,
  worldId: string,
  nationId: string,
): Promise<readonly OfficeType[]> {
  const { data, error } = await client
    .from("office_types")
    .select(OFFICE_TYPE_SELECT)
    .eq("world_id", worldId)
    .eq("scope", "nation")
    .or(`nation_id.is.null,nation_id.eq.${nationId}`)
    .order("name");

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toOfficeType);
}

type SettlementOfficeTypesQueryKey = ReturnType<
  typeof nationOfficesQueryKeys.officeTypesForSettlements
>;
type SettlementOfficeTypesQueryOptions = UseQueryOptions<
  readonly OfficeType[],
  AuthUiError,
  readonly OfficeType[],
  SettlementOfficeTypesQueryKey
>;

// World-default settlement office types (nation_id null) plus this nation's
// own custom settlement office types (#1115) -- the full set of offices
// appointable from any of the nation's settlement government tabs. Keyed by
// (worldId, nationId), not settlementId -- office types are owned by the
// nation, not any one settlement.
export function settlementOfficeTypesQueryOptions(
  worldId: string,
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementOfficeTypesQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementOfficeTypes(client, worldId, nationId),
    queryKey: nationOfficesQueryKeys.officeTypesForSettlements(
      worldId,
      nationId,
    ),
  });
}

async function getSettlementOfficeTypes(
  client: GubernatorSupabaseClient,
  worldId: string,
  nationId: string,
): Promise<readonly OfficeType[]> {
  const { data, error } = await client
    .from("office_types")
    .select(OFFICE_TYPE_SELECT)
    .eq("world_id", worldId)
    .eq("scope", "settlement")
    .or(`nation_id.is.null,nation_id.eq.${nationId}`)
    .order("name");

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toOfficeType);
}

type WorldDefaultOfficeTypesQueryKey = ReturnType<
  typeof nationOfficesQueryKeys.officeTypesWorldDefaults
>;
type WorldDefaultOfficeTypesQueryOptions = UseQueryOptions<
  readonly OfficeType[],
  AuthUiError,
  readonly OfficeType[],
  WorldDefaultOfficeTypesQueryKey
>;

// World-default office types only (nation_id null) -- the world config
// admin panel manages these directly.
export function worldDefaultOfficeTypesQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldDefaultOfficeTypesQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getWorldDefaultOfficeTypes(client, worldId),
    queryKey: nationOfficesQueryKeys.officeTypesWorldDefaults(worldId),
  });
}

async function getWorldDefaultOfficeTypes(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly OfficeType[]> {
  const { data, error } = await client
    .from("office_types")
    .select(OFFICE_TYPE_SELECT)
    .eq("world_id", worldId)
    .is("nation_id", null)
    .order("name");

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toOfficeType);
}
