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
  setBulkStandardJobAssignmentInputSchema,
  type SetBulkStandardJobAssignmentInput,
} from "../schemas/setBulkStandardJobAssignmentSchemas";

import type { BulkStandardJobAssignmentResult } from "../types/bulkAssignmentTypes";
import type { z } from "zod";

type BulkStandardJobAssignmentMutationErrorCode =
  | "bulk_assignment_failed"
  | "bulk_assignment_input_invalid";

type SetBulkStandardJobAssignmentMutationOptions = UseMutationOptions<
  BulkStandardJobAssignmentResult,
  AuthUiError | BulkStandardJobAssignmentMutationError,
  SetBulkStandardJobAssignmentInput
>;

export type BulkStandardJobAssignmentMutationIssue = MutationIssue;

export const {
  ErrorClass: BulkStandardJobAssignmentMutationError,
  isError: isBulkStandardJobAssignmentMutationError,
} = createMutationError<BulkStandardJobAssignmentMutationErrorCode>(
  "BulkStandardJobAssignmentMutationError",
);
export type BulkStandardJobAssignmentMutationError = InstanceType<
  typeof BulkStandardJobAssignmentMutationError
>;

type RpcResultRow = {
  readonly after: number;
  readonly added_citizen_ids: string[];
  readonly before: number;
  readonly removed_citizen_ids: string[];
};

export function setBulkStandardJobAssignmentMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetBulkStandardJobAssignmentMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetBulkStandardJobAssignmentInput) =>
      setBulkStandardJobAssignment(client, input),
    mutationKey: [...citizensQueryKeys.all, "set-bulk-standard-job-assignment"],
    onSuccess: async (_result, input): Promise<void> => {
      const values = setBulkStandardJobAssignmentInputSchema.parse(input);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.assignmentsInSettlement(
            values.settlementId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.settlementJobCounts(values.settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.settlementAggregateStats(
            values.settlementId,
          ),
        }),
      ]);
    },
  });
}

async function setBulkStandardJobAssignment(
  client: GubernatorSupabaseClient,
  input: SetBulkStandardJobAssignmentInput,
): Promise<BulkStandardJobAssignmentResult> {
  const values = parseInput(setBulkStandardJobAssignmentInputSchema, input);

  const { data, error } = await client
    .rpc("set_bulk_standard_job_assignment", {
      p_job_id: values.jobId,
      p_settlement_id: values.settlementId,
      p_target_count: values.targetCount,
    })
    .maybeSingle<RpcResultRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new BulkStandardJobAssignmentMutationError({
      code: "bulk_assignment_failed",
      message: "Bulk standard job assignment returned no result.",
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
      new BulkStandardJobAssignmentMutationError({
        code: "bulk_assignment_input_invalid",
        issues,
        message: "Bulk standard job assignment input is invalid.",
      }),
  );
}
