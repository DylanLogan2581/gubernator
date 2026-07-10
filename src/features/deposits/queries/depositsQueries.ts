import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import {
  DEPOSIT_TYPE_SELECT,
  toDepositType,
  type DepositTypeRow,
} from "./depositRow";
import { depositsQueryKeys } from "./depositsQueryKeys";

import type { DepositType } from "../types/depositTypes";

type DepositTypesByWorldQueryKey = ReturnType<typeof depositsQueryKeys.byWorld>;
type ActiveDepositTypesByWorldQueryKey = ReturnType<
  typeof depositsQueryKeys.activeByWorld
>;
type DepositTypeDetailQueryKey = ReturnType<typeof depositsQueryKeys.detail>;

type DepositTypesByWorldQueryOptions = UseQueryOptions<
  readonly DepositType[],
  AuthUiError,
  readonly DepositType[],
  DepositTypesByWorldQueryKey
>;
type ActiveDepositTypesByWorldQueryOptions = UseQueryOptions<
  readonly DepositType[],
  AuthUiError,
  readonly DepositType[],
  ActiveDepositTypesByWorldQueryKey
>;
type DepositTypeDetailQueryOptions = UseQueryOptions<
  DepositType | null,
  AuthUiError,
  DepositType | null,
  DepositTypeDetailQueryKey
>;

export function depositTypesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DepositTypesByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getDepositTypesByWorld(c, worldId),
    queryKey: depositsQueryKeys.byWorld(worldId),
  });
}

export function activeDepositTypesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ActiveDepositTypesByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getActiveDepositTypesByWorld(c, worldId),
    queryKey: depositsQueryKeys.activeByWorld(worldId),
  });
}

export function depositTypeByIdQueryOptions(
  depositTypeId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DepositTypeDetailQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getDepositTypeById(c, depositTypeId),
    queryKey: depositsQueryKeys.detail(depositTypeId),
  });
}

export type DepositTypesSortBy = "job" | "name" | "outputUnitsPerWorker";

export type DepositTypesPageParams = {
  readonly jobId?: string | null;
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly sortBy?: DepositTypesSortBy;
  readonly sortDirection?: "asc" | "desc";
  readonly trash: boolean;
};

export type DepositTypesPage = {
  readonly items: readonly DepositType[];
  readonly totalCount: number;
};

type DepositTypesPageQueryKey = ReturnType<typeof depositsQueryKeys.page>;
type DepositTypesPageQueryOptions = UseQueryOptions<
  DepositTypesPage,
  AuthUiError,
  DepositTypesPage,
  DepositTypesPageQueryKey
>;

// Config panel table (#1032): server-side search + pagination + trash
// filtering so the client only ever holds one page of deposit types, not
// the whole world's list.
export function depositTypesPageQueryOptions(
  worldId: string,
  params: DepositTypesPageParams,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DepositTypesPageQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return {
    queryFn: () => getDepositTypesPage(client, worldId, params),
    queryKey: depositsQueryKeys.page(worldId, params),
  };
}

async function getDepositTypesPage(
  client: GubernatorSupabaseClient,
  worldId: string,
  params: DepositTypesPageParams,
): Promise<DepositTypesPage> {
  const pageStart = params.page * params.pageSize;
  const pageEnd = pageStart + params.pageSize - 1;
  const search = params.search?.trim() ?? "";

  let query = client
    .from("deposit_types")
    .select(DEPOSIT_TYPE_SELECT, { count: "exact" })
    .eq("world_id", worldId)
    .eq("is_trashed", params.trash);

  if (params.jobId !== undefined && params.jobId !== null) {
    query = query.eq("job_id", params.jobId);
  }

  if (search !== "") {
    query = query.ilike("name", `%${search}%`);
  }

  const sortAscending = params.sortDirection !== "desc";

  if (params.sortBy === "job") {
    query = query
      .order("name", {
        ascending: sortAscending,
        referencedTable: "job",
      })
      .order("name", { ascending: true });
  } else if (params.sortBy === "outputUnitsPerWorker") {
    query = query
      .order("output_units_per_worker", { ascending: sortAscending })
      .order("name", { ascending: true });
  } else {
    query = query.order("name", { ascending: sortAscending });
  }

  const { data, error, count } = await query
    .order("id", { ascending: true })
    .range(pageStart, pageEnd)
    .returns<DepositTypeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return {
    items: data.map(toDepositType),
    totalCount: count ?? 0,
  };
}

async function getDepositTypesByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly DepositType[]> {
  const { data, error } = await client
    .from("deposit_types")
    .select(DEPOSIT_TYPE_SELECT)
    .eq("world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<DepositTypeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toDepositType);
}

async function getActiveDepositTypesByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly DepositType[]> {
  const { data, error } = await client
    .from("deposit_types")
    .select(DEPOSIT_TYPE_SELECT)
    .eq("world_id", worldId)
    .eq("is_trashed", false)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<DepositTypeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toDepositType);
}

async function getDepositTypeById(
  client: GubernatorSupabaseClient,
  depositTypeId: string,
): Promise<DepositType | null> {
  const { data, error } = await client
    .from("deposit_types")
    .select(DEPOSIT_TYPE_SELECT)
    .eq("id", depositTypeId)
    .maybeSingle<DepositTypeRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toDepositType(data);
}
