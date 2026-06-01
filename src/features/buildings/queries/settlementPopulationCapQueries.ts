import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { buildingsQueryKeys } from "./buildingsQueryKeys";

type SettlementPopulationCapQueryKey = ReturnType<
  typeof buildingsQueryKeys.settlementPopulationCap
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
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getSettlementPopulationCap(c, settlementId),
    queryKey: buildingsQueryKeys.settlementPopulationCap(settlementId),
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
