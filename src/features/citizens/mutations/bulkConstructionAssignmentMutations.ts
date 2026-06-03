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
  setBulkConstructionAssignmentInputSchema,
  type SetBulkConstructionAssignmentInput,
} from "../schemas/setBulkConstructionAssignmentSchemas";

import type { BulkConstructionAssignmentResult } from "../types/bulkAssignmentTypes";
import type { z } from "zod";

type BulkConstructionAssignmentMutationErrorCode =
  | "bulk_assignment_failed"
  | "bulk_assignment_input_invalid";

type SetBulkConstructionAssignmentMutationOptions = UseMutationOptions<
  BulkConstructionAssignmentResult,
  AuthUiError | BulkConstructionAssignmentMutationError,
  SetBulkConstructionAssignmentInput
>;

export type BulkConstructionAssignmentMutationIssue = MutationIssue;

export const {
  ErrorClass: BulkConstructionAssignmentMutationError,
  isError: isBulkConstructionAssignmentMutationError,
} = createMutationError<BulkConstructionAssignmentMutationErrorCode>(
  "BulkConstructionAssignmentMutationError",
);
export type BulkConstructionAssignmentMutationError = InstanceType<
  typeof BulkConstructionAssignmentMutationError
>;

type RpcResultRow = {
  readonly after: number;
  readonly added_citizen_ids: string[];
  readonly before: number;
  readonly removed_citizen_ids: string[];
};

export function setBulkConstructionAssignmentMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetBulkConstructionAssignmentMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetBulkConstructionAssignmentInput) =>
      setBulkConstructionAssignment(client, input),
    mutationKey: [...citizensQueryKeys.all, "set-bulk-construction-assignment"],
    onSuccess: async (_result, input): Promise<void> => {
      const values = setBulkConstructionAssignmentInputSchema.parse(input);
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

async function setBulkConstructionAssignment(
  client: GubernatorSupabaseClient,
  input: SetBulkConstructionAssignmentInput,
): Promise<BulkConstructionAssignmentResult> {
  const values = parseInput(setBulkConstructionAssignmentInputSchema, input);

  const { data, error } = await client
    .rpc("set_bulk_construction_assignment", {
      p_construction_project_id: values.constructionProjectId,
      p_target_count: values.targetCount,
    })
    .maybeSingle<RpcResultRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new BulkConstructionAssignmentMutationError({
      code: "bulk_assignment_failed",
      message: "Bulk construction assignment returned no result.",
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
      new BulkConstructionAssignmentMutationError({
        code: "bulk_assignment_input_invalid",
        issues,
        message: "Bulk construction assignment input is invalid.",
      }),
  );
}
