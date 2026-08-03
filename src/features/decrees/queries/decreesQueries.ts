import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { decreesQueryKeys } from "./decreesQueryKeys";

import type { Decree } from "../types/decreeTypes";

const DECREE_SELECT =
  "id,world_id,nation_id,settlement_id,title,body_markdown,issued_by_citizen_id,issued_turn_number,revoked_turn_number,created_at";

type DecreeRow = {
  readonly body_markdown: string;
  readonly created_at: string;
  readonly id: string;
  readonly issued_by_citizen_id: string | null;
  readonly issued_turn_number: number;
  readonly nation_id: string | null;
  readonly revoked_turn_number: number | null;
  readonly settlement_id: string | null;
  readonly title: string;
  readonly world_id: string;
};

function toDecree(row: DecreeRow): Decree {
  return {
    bodyMarkdown: row.body_markdown,
    createdAt: row.created_at,
    id: row.id,
    issuedByCitizenId: row.issued_by_citizen_id,
    issuedTurnNumber: row.issued_turn_number,
    nationId: row.nation_id,
    revokedTurnNumber: row.revoked_turn_number,
    settlementId: row.settlement_id,
    title: row.title,
    worldId: row.world_id,
  };
}

export const DECREES_PAGE_SIZE = 20;

export type DecreePage = {
  readonly decrees: readonly Decree[];
  readonly totalCount: number;
};

type DecreeListQueryOptions<TKey extends readonly unknown[]> = UseQueryOptions<
  DecreePage,
  AuthUiError,
  DecreePage,
  TKey
>;

// Reverse-chronological (newest issued first) -- matches the government tab
// log's display order.
export function nationDecreesQueryOptions(
  nationId: string,
  page = 0,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DecreeListQueryOptions<ReturnType<typeof decreesQueryKeys.nationListPage>> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationDecrees(client, nationId, page),
    queryKey: decreesQueryKeys.nationListPage(nationId, page),
  });
}

async function getNationDecrees(
  client: GubernatorSupabaseClient,
  nationId: string,
  page: number,
): Promise<DecreePage> {
  const from = page * DECREES_PAGE_SIZE;
  const to = from + DECREES_PAGE_SIZE - 1;

  const { data, error, count } = await client
    .from("decrees")
    .select(DECREE_SELECT, { count: "exact" })
    .eq("nation_id", nationId)
    .order("issued_turn_number", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<DecreeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return { decrees: data.map(toDecree), totalCount: count ?? 0 };
}

export function settlementDecreesQueryOptions(
  settlementId: string,
  page = 0,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DecreeListQueryOptions<
  ReturnType<typeof decreesQueryKeys.settlementListPage>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementDecrees(client, settlementId, page),
    queryKey: decreesQueryKeys.settlementListPage(settlementId, page),
  });
}

async function getSettlementDecrees(
  client: GubernatorSupabaseClient,
  settlementId: string,
  page: number,
): Promise<DecreePage> {
  const from = page * DECREES_PAGE_SIZE;
  const to = from + DECREES_PAGE_SIZE - 1;

  const { data, error, count } = await client
    .from("decrees")
    .select(DECREE_SELECT, { count: "exact" })
    .eq("settlement_id", settlementId)
    .order("issued_turn_number", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<DecreeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return { decrees: data.map(toDecree), totalCount: count ?? 0 };
}
