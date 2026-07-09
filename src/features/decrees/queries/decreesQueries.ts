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

type DecreeListQueryOptions<TKey extends readonly unknown[]> = UseQueryOptions<
  readonly Decree[],
  AuthUiError,
  readonly Decree[],
  TKey
>;

// Reverse-chronological (newest issued first) -- matches the government tab
// log's display order.
export function nationDecreesQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DecreeListQueryOptions<ReturnType<typeof decreesQueryKeys.nationList>> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationDecrees(client, nationId),
    queryKey: decreesQueryKeys.nationList(nationId),
  });
}

async function getNationDecrees(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly Decree[]> {
  const { data, error } = await client
    .from("decrees")
    .select(DECREE_SELECT)
    .eq("nation_id", nationId)
    .order("issued_turn_number", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<DecreeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toDecree);
}

export function settlementDecreesQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DecreeListQueryOptions<ReturnType<typeof decreesQueryKeys.settlementList>> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementDecrees(client, settlementId),
    queryKey: decreesQueryKeys.settlementList(settlementId),
  });
}

async function getSettlementDecrees(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly Decree[]> {
  const { data, error } = await client
    .from("decrees")
    .select(DECREE_SELECT)
    .eq("settlement_id", settlementId)
    .order("issued_turn_number", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<DecreeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toDecree);
}
