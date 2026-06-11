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

import { citizensQueryKeys } from "../queries/citizensQueryKeys";
import {
  setBulkConstructionPoolInputSchema,
  type SetBulkConstructionPoolInput,
} from "../schemas/setBulkConstructionPoolSchemas";

import type { BulkConstructionAssignmentResult } from "../types/bulkAssignmentTypes";
import type { z } from "zod";

type BulkConstructionPoolMutationErrorCode =
  | "bulk_assignment_failed"
  | "bulk_assignment_input_invalid";

type SetBulkConstructionPoolMutationOptions = UseMutationOptions<
  BulkConstructionAssignmentResult,
  AuthUiError | BulkConstructionPoolMutationError,
  SetBulkConstructionPoolInput
>;

export type BulkConstructionPoolMutationIssue = MutationIssue;

export const {
  ErrorClass: BulkConstructionPoolMutationError,
  isError: isBulkConstructionPoolMutationError,
} = createMutationError<BulkConstructionPoolMutationErrorCode>(
  "BulkConstructionPoolMutationError",
);
export type BulkConstructionPoolMutationError = InstanceType<
  typeof BulkConstructionPoolMutationError
>;

type RpcResultRow = {
  readonly after: number;
  readonly added_citizen_ids: string[];
  readonly before: number;
  readonly removed_citizen_ids: string[];
};

export function setBulkConstructionPoolMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetBulkConstructionPoolMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetBulkConstructionPoolInput) =>
      setBulkConstructionPool(client, input),
    mutationKey: [...citizensQueryKeys.all, "set-bulk-construction-pool"],
    onSuccess: async (_result, input): Promise<void> => {
      const values = setBulkConstructionPoolInputSchema.parse(input);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.assignmentsInSettlement(
            values.settlementId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.settlementConstructionProjectCounts(
            values.settlementId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.settlementAggregateStats(
            values.settlementId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.settlementList(values.settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.settlementJobCounts(values.settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: [
            ...citizensQueryKeys.all,
            "current-assignment-for-citizen",
          ],
        }),
      ]);
    },
  });
}

async function setBulkConstructionPool(
  client: GubernatorSupabaseClient,
  input: SetBulkConstructionPoolInput,
): Promise<BulkConstructionAssignmentResult> {
  const values = parseInput(setBulkConstructionPoolInputSchema, input);

  const { data, error } = await client
    .rpc("set_bulk_construction_pool", {
      p_settlement_id: values.settlementId,
      p_target_count: values.targetCount,
    })
    .maybeSingle<RpcResultRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new BulkConstructionPoolMutationError({
      code: "bulk_assignment_failed",
      message: "Bulk construction pool assignment returned no result.",
    });
  }

  return {
    after: data.after,
    addedCitizenIds: data.added_citizen_ids,
    before: data.before,
    removedCitizenIds: data.removed_citizen_ids,
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
      new BulkConstructionPoolMutationError({
        code: "bulk_assignment_input_invalid",
        issues,
        message: "Bulk construction pool input is invalid.",
      }),
  );
}
