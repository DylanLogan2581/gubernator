import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationsQueryKeys } from "../queries/nationsQueryKeys";
import {
  deleteNationTaxPolicyInputSchema,
  demandTributeInputSchema,
  upsertNationTaxPolicyInputSchema,
  type DeleteNationTaxPolicyInput,
  type DemandTributeInput,
  type UpsertNationTaxPolicyInput,
} from "../schemas/taxPolicySchemas";

import type { NationTaxPolicy, TaxMethod } from "../types/taxPolicyTypes";
import type { z } from "zod";

export type { DeleteNationTaxPolicyInput };
export type { DemandTributeInput };
export type { UpsertNationTaxPolicyInput };

export type DemandTributeLineResult = {
  readonly clamped: boolean;
  readonly resourceId: string;
  readonly seizedQuantity: number;
};

type TaxPolicyMutationErrorCode = "tax_policy_input_invalid";

export type TaxPolicyMutationIssue = MutationIssue;

export const {
  ErrorClass: TaxPolicyMutationError,
  isError: isTaxPolicyMutationError,
} = createMutationError<TaxPolicyMutationErrorCode>("TaxPolicyMutationError");
export type TaxPolicyMutationError = InstanceType<
  typeof TaxPolicyMutationError
>;

export type UpsertNationTaxPolicyMutationOptions = UseMutationOptions<
  NationTaxPolicy,
  AuthUiError | TaxPolicyMutationError,
  UpsertNationTaxPolicyInput
>;
export type DeleteNationTaxPolicyMutationOptions = UseMutationOptions<
  void,
  AuthUiError | TaxPolicyMutationError,
  DeleteNationTaxPolicyInput
>;
export type DemandTributeMutationOptions = UseMutationOptions<
  readonly DemandTributeLineResult[],
  AuthUiError | TaxPolicyMutationError,
  DemandTributeInput
>;

export function upsertNationTaxPolicyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpsertNationTaxPolicyMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpsertNationTaxPolicyInput) =>
      upsertNationTaxPolicy(client, input),
    mutationKey: [...nationsQueryKeys.all, "upsert-nation-tax-policy"],
    onSuccess: async (_result, input): Promise<void> => {
      // The default rule also mirrors onto nations.tax_rate (shown on the
      // treasury tab), so refresh the nation detail alongside the policies.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.taxPolicies(input.nationId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.detail(input.nationId),
        }),
      ]);
    },
  });
}

export function deleteNationTaxPolicyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteNationTaxPolicyMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteNationTaxPolicyInput) =>
      deleteNationTaxPolicy(client, input),
    mutationKey: [...nationsQueryKeys.all, "delete-nation-tax-policy"],
    onSuccess: async (_result, input): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: nationsQueryKeys.taxPolicies(input.nationId),
      });
    },
  });
}

export function demandTributeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DemandTributeMutationOptions {
  return mutationOptions({
    mutationFn: (input: DemandTributeInput) => demandTribute(client, input),
    mutationKey: [...nationsQueryKeys.all, "demand-tribute"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.treasuryStockpile(input.nationId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.detail(input.nationId),
        }),
      ]);
    },
  });
}

type TaxPolicyRpcRow = {
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

async function upsertNationTaxPolicy(
  client: GubernatorSupabaseClient,
  input: UpsertNationTaxPolicyInput,
): Promise<NationTaxPolicy> {
  const values = parseInput(upsertNationTaxPolicyInputSchema, input);

  const { data, error } = await client.rpc("upsert_nation_tax_policy", {
    p_exempt: values.exempt,
    p_flat_amount: values.flatAmount,
    p_method: values.method,
    p_min_stockpile_floor: values.minStockpileFloor,
    p_nation_id: values.nationId,
    // The RPC accepts null (default rule / all resources), but the generated
    // Args types mark these non-null; cast to preserve the null semantics.
    p_rate: values.rate,
    p_settlement_id: values.settlementId as string,
    p_taxed_resource_ids: values.taxedResourceIds as string[],
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  const row = (data as readonly TaxPolicyRpcRow[])[0];
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

async function deleteNationTaxPolicy(
  client: GubernatorSupabaseClient,
  input: DeleteNationTaxPolicyInput,
): Promise<void> {
  const values = parseInput(deleteNationTaxPolicyInputSchema, input);

  const { error } = await client.rpc("delete_nation_tax_policy", {
    p_nation_id: values.nationId,
    p_settlement_id: values.settlementId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}

async function demandTribute(
  client: GubernatorSupabaseClient,
  input: DemandTributeInput,
): Promise<readonly DemandTributeLineResult[]> {
  const values = parseInput(demandTributeInputSchema, input);

  const { data, error } = await client.rpc("demand_tribute", {
    p_items: values.items.map((item) => ({
      quantity: item.quantity,
      resource_id: item.resourceId,
    })),
    p_nation_id: values.nationId,
    p_settlement_id: values.settlementId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map((row) => ({
    clamped: row.clamped,
    resourceId: row.resource_id,
    seizedQuantity: row.seized_quantity,
  }));
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new TaxPolicyMutationError({
        code: "tax_policy_input_invalid",
        issues,
        message: "Tax policy input is invalid.",
      }),
  );
}
