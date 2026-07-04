import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { citizensQueryKeys } from "./citizensQueryKeys";

import type { CitizenStatus, CitizenType } from "../types/citizenTypes";

// World-level citizen directory (#989): server-side filtered/paginated view
// over citizen_directory_view so the client never fetches every citizen in
// the world — only the current page plus a total count for the pager.

export type CitizenDirectoryFilters = {
  readonly citizenType?: CitizenType;
  readonly nationId?: string;
  readonly search?: string;
  readonly settlementId?: string;
  readonly status?: CitizenStatus;
};

export type CitizenDirectoryPagination = {
  readonly pageIndex: number;
  readonly pageSize: number;
};

export type CitizenDirectoryRow = {
  readonly ageTurns: number | null;
  readonly assignmentLabel: string | null;
  readonly citizenType: CitizenType;
  readonly id: string;
  readonly name: string | null;
  readonly nationId: string | null;
  readonly nationName: string | null;
  readonly settlementId: string | null;
  readonly settlementName: string | null;
  readonly sex: string | null;
  readonly status: CitizenStatus;
};

export type CitizenDirectoryPage = {
  readonly rows: readonly CitizenDirectoryRow[];
  readonly totalCount: number;
};

type CitizenDirectoryQueryKey = ReturnType<typeof citizensQueryKeys.directory>;
type CitizenDirectoryQueryOptions = UseQueryOptions<
  CitizenDirectoryPage,
  AuthUiError,
  CitizenDirectoryPage,
  CitizenDirectoryQueryKey
>;

type CitizenDirectoryRowData = {
  readonly age_turns: number | null;
  readonly assignment_label: string | null;
  readonly citizen_type: CitizenType;
  readonly id: string;
  readonly name: string | null;
  readonly nation_id: string | null;
  readonly nation_name: string | null;
  readonly settlement_id: string | null;
  readonly settlement_name: string | null;
  readonly sex: string | null;
  readonly status: CitizenStatus;
};

const CITIZEN_DIRECTORY_SELECT =
  "id,name,sex,status,citizen_type,age_turns,settlement_id,settlement_name,nation_id,nation_name,assignment_label";

export function citizensDirectoryQueryOptions(
  worldId: string,
  filters: CitizenDirectoryFilters,
  pagination: CitizenDirectoryPagination,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CitizenDirectoryQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCitizensDirectory(client, worldId, filters, pagination),
    queryKey: citizensQueryKeys.directory(worldId, filters, pagination),
  });
}

async function getCitizensDirectory(
  client: GubernatorSupabaseClient,
  worldId: string,
  filters: CitizenDirectoryFilters,
  pagination: CitizenDirectoryPagination,
): Promise<CitizenDirectoryPage> {
  const pageStart = pagination.pageIndex * pagination.pageSize;
  const pageEnd = pageStart + pagination.pageSize - 1;
  const search = filters.search?.trim() ?? "";

  let query = client
    .from("citizen_directory_view")
    .select(CITIZEN_DIRECTORY_SELECT, { count: "exact" })
    .eq("world_id", worldId);

  if (filters.settlementId !== undefined) {
    query = query.eq("settlement_id", filters.settlementId);
  }
  if (filters.nationId !== undefined) {
    query = query.eq("nation_id", filters.nationId);
  }
  if (filters.citizenType !== undefined) {
    query = query.eq("citizen_type", filters.citizenType);
  }
  if (filters.status !== undefined) {
    query = query.eq("status", filters.status);
  }
  if (search !== "") {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error, count } = await query
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .range(pageStart, pageEnd)
    .returns<CitizenDirectoryRowData[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return {
    rows: data.map(toCitizenDirectoryRow),
    totalCount: count ?? 0,
  };
}

function toCitizenDirectoryRow(
  row: CitizenDirectoryRowData,
): CitizenDirectoryRow {
  return {
    ageTurns: row.age_turns,
    assignmentLabel: row.assignment_label,
    citizenType: row.citizen_type,
    id: row.id,
    name: row.name,
    nationId: row.nation_id,
    nationName: row.nation_name,
    settlementId: row.settlement_id,
    settlementName: row.settlement_name,
    sex: row.sex,
    status: row.status,
  };
}
