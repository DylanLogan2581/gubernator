import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { resourcesQueryKeys } from "../queries/resourcesQueryKeys";
import {
  updateSettlementStockpileInputSchema,
  type UpdateSettlementStockpileInput,
} from "../schemas/settlementStockpileSchemas";

import type { z } from "zod";

type StockpileMutationErrorCode =
  | "stockpile_input_invalid"
  | "stockpile_not_authorized"
  | "stockpile_not_found"
  | "stockpile_resource_trashed";

export type StockpileMutationIssue = MutationIssue;

export const {
  ErrorClass: StockpileMutationError,
  isError: isStockpileMutationError,
} = createMutationError<StockpileMutationErrorCode>("StockpileMutationError");
export type StockpileMutationError = InstanceType<
  typeof StockpileMutationError
>;

export type SettlementStockpileResult = {
  readonly quantity: number;
  readonly resourceId: string;
  readonly settlementId: string;
};

type UpdateSettlementStockpileMutationOptions = UseMutationOptions<
  SettlementStockpileResult,
  Error,
  UpdateSettlementStockpileInput
>;

export function updateSettlementStockpileMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateSettlementStockpileMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateSettlementStockpileInput) =>
      setSettlementStockpileQuantity(client, input),
    mutationKey: [
      ...resourcesQueryKeys.all,
      "set-settlement-stockpile-quantity",
    ],
    onSuccess: async (result): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: resourcesQueryKeys.stockpilesBySettlement(
          result.settlementId,
        ),
      });
    },
  });
}

async function setSettlementStockpileQuantity(
  client: GubernatorSupabaseClient,
  input: UpdateSettlementStockpileInput,
): Promise<SettlementStockpileResult> {
  const values = parseInput(updateSettlementStockpileInputSchema, input);

  const { data, error } = await client
    .rpc("set_settlement_stockpile_quantity", {
      p_quantity: values.quantity,
      p_resource_id: values.resourceId,
      p_settlement_id: values.settlementId,
    })
    .maybeSingle<{
      readonly quantity: number;
      readonly resource_id: string;
      readonly settlement_id: string;
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new StockpileMutationError({
        code: "stockpile_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0001") {
      throw new StockpileMutationError({
        code: "stockpile_resource_trashed",
        message: "Resource is soft-deleted.",
      });
    }
    if (error.code === "P0002") {
      throw new StockpileMutationError({
        code: "stockpile_not_found",
        message: "Settlement or resource not found.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new StockpileMutationError({
      code: "stockpile_not_found",
      message: "Stockpile could not be updated.",
    });
  }

  return {
    quantity: data.quantity,
    resourceId: data.resource_id,
    settlementId: data.settlement_id,
  };
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new StockpileMutationError({
        code: "stockpile_input_invalid",
        issues,
        message: "Stockpile input is invalid.",
      }),
  );
}
