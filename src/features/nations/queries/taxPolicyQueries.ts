import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { nationsQueryKeys } from "./nationsQueryKeys";

import type { NationTaxPolicy, TaxMethod } from "../types/taxPolicyTypes";

type NationTaxPoliciesQueryKey = ReturnType<
  typeof nationsQueryKeys.taxPolicies
>;
type NationTaxPoliciesQueryOptions = UseQueryOptions<
  readonly NationTaxPolicy[],
  AuthUiError,
  readonly NationTaxPolicy[],
  NationTaxPoliciesQueryKey
>;

const TAX_POLICY_SELECT =
  "id,nation_id,settlement_id,method,rate,flat_amount,taxed_resource_ids,min_stockpile_floor,exempt";

type TaxPolicyRow = {
  readonly exempt: boolean;
  readonly flat_amount: number;
  readonly id: string;
  readonly method: TaxMethod;
  readonly min_stockpile_floor: number;
  readonly nation_id: string;
  readonly rate: number;
  readonly settlement_id: string | null;
  readonly taxed_resource_ids: string[] | null;
};

export function nationTaxPoliciesQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationTaxPoliciesQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getNationTaxPolicies(c, nationId),
    queryKey: nationsQueryKeys.taxPolicies(nationId),
  });
}

async function getNationTaxPolicies(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly NationTaxPolicy[]> {
  const { data, error } = await client
    .from("nation_tax_policies")
    .select(TAX_POLICY_SELECT)
    .eq("nation_id", nationId)
    .returns<TaxPolicyRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toTaxPolicy);
}

function toTaxPolicy(row: TaxPolicyRow): NationTaxPolicy {
  return {
    exempt: row.exempt,
    flatAmount: row.flat_amount,
    id: row.id,
    method: row.method,
    minStockpileFloor: row.min_stockpile_floor,
    nationId: row.nation_id,
    rate: row.rate,
    settlementId: row.settlement_id,
    taxedResourceIds: row.taxed_resource_ids,
  };
}
