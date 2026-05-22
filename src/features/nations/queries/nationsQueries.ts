import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeAuthError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationsQueryKeys } from "./nationsQueryKeys";

import type { Nation, NationSettlement } from "../types/nationTypes";

type NationListQueryKey = ReturnType<typeof nationsQueryKeys.list>;
type NationDetailQueryKey = ReturnType<typeof nationsQueryKeys.detail>;
type NationSettlementsQueryKey = ReturnType<
  typeof nationsQueryKeys.settlements
>;

type NationListQueryOptions = UseQueryOptions<
  readonly Nation[],
  AuthUiError,
  readonly Nation[],
  NationListQueryKey
>;
type NationDetailQueryOptions = UseQueryOptions<
  Nation | null,
  AuthUiError,
  Nation | null,
  NationDetailQueryKey
>;
type NationSettlementsQueryOptions = UseQueryOptions<
  readonly NationSettlement[],
  AuthUiError,
  readonly NationSettlement[],
  NationSettlementsQueryKey
>;

type NationRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly is_hidden: boolean;
  readonly name: string;
  readonly updated_at: string;
  readonly world_id: string;
};
type NationSettlementRow = {
  readonly id: string;
  readonly name: string;
  readonly nation_id: string;
};

const NATION_SELECT =
  "id,world_id,name,description,is_hidden,created_at,updated_at";
const NATION_SETTLEMENT_SELECT = "id,name,nation_id";

export function nationsListQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationListQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationsList(client, worldId),
    queryKey: nationsQueryKeys.list(worldId),
  });
}

export function nationByIdQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationById(client, nationId),
    queryKey: nationsQueryKeys.detail(nationId),
  });
}

export function nationSettlementsQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationSettlementsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationSettlements(client, nationId),
    queryKey: nationsQueryKeys.settlements(nationId),
  });
}

async function getNationsList(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly Nation[]> {
  const { data, error } = await client
    .from("nations")
    .select(NATION_SELECT)
    .eq("world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<NationRow[]>();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data.map(toNation);
}

async function getNationById(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<Nation | null> {
  const { data, error } = await client
    .from("nations")
    .select(NATION_SELECT)
    .eq("id", nationId)
    .maybeSingle<NationRow>();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data === null ? null : toNation(data);
}

async function getNationSettlements(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly NationSettlement[]> {
  const { data, error } = await client
    .from("settlements")
    .select(NATION_SETTLEMENT_SELECT)
    .eq("nation_id", nationId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<NationSettlementRow[]>();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data.map(toNationSettlement);
}

function toNation(row: NationRow): Nation {
  return {
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    isHidden: row.is_hidden,
    name: row.name,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}

function toNationSettlement(row: NationSettlementRow): NationSettlement {
  return {
    id: row.id,
    name: row.name,
    nationId: row.nation_id,
  };
}
