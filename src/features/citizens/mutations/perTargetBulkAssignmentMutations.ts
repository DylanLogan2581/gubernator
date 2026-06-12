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
  setPerTargetBulkAssignmentInputSchema,
  type SetPerTargetBulkAssignmentInput,
} from "../schemas/setPerTargetBulkAssignmentSchemas";

import type { PerTargetBulkAssignmentResult } from "../types/bulkAssignmentTypes";
import type { CitizenAggregateStats } from "../types/citizenTypes";
import type { z } from "zod";

type PerTargetBulkAssignmentMutationErrorCode =
  | "per_target_bulk_assignment_failed"
  | "per_target_bulk_assignment_input_invalid";

type SetPerTargetBulkAssignmentMutationOptions = UseMutationOptions<
  PerTargetBulkAssignmentResult,
  AuthUiError | PerTargetBulkAssignmentMutationError,
  SetPerTargetBulkAssignmentInput
>;

export type PerTargetBulkAssignmentMutationIssue = MutationIssue;

export const {
  ErrorClass: PerTargetBulkAssignmentMutationError,
  isError: isPerTargetBulkAssignmentMutationError,
} = createMutationError<PerTargetBulkAssignmentMutationErrorCode>(
  "PerTargetBulkAssignmentMutationError",
);
export type PerTargetBulkAssignmentMutationError = InstanceType<
  typeof PerTargetBulkAssignmentMutationError
>;

type RpcResultRow = {
  readonly after: number;
  readonly added_citizen_ids: string[];
  readonly before: number;
  readonly removed_citizen_ids: string[];
};

export function setPerTargetBulkAssignmentMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetPerTargetBulkAssignmentMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetPerTargetBulkAssignmentInput) =>
      setPerTargetBulkAssignment(client, input),
    mutationKey: [...citizensQueryKeys.all, "set-per-target-bulk-assignment"],
    onSuccess: async (result, input): Promise<void> => {
      const values = setPerTargetBulkAssignmentInputSchema.parse(input);
      const delta = result.after - result.before;

      // Optimistically update aggregate stats cache so unassigned count reflects immediately
      queryClient.setQueryData(
        citizensQueryKeys.settlementAggregateStats(values.settlementId),
        (prev: CitizenAggregateStats | undefined) => {
          if (prev === null || prev === undefined) return prev;
          return {
            ...prev,
            unassignedNpcCount: Math.max(0, prev.unassignedNpcCount - delta),
          };
        },
      );

      // Invalidate queries to ensure consistency on background refresh
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.assignmentsInSettlement(
            values.settlementId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.settlementTargetAssignments(
            values.settlementId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: citizensQueryKeys.settlementAggregateStats(
            values.settlementId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: ["forecast"],
        }),
      ]);
    },
  });
}

async function setPerTargetBulkAssignment(
  client: GubernatorSupabaseClient,
  input: SetPerTargetBulkAssignmentInput,
): Promise<PerTargetBulkAssignmentResult> {
  const values = parseInput(setPerTargetBulkAssignmentInputSchema, input);

  const tradeRouteEnd =
    values.assignmentType === "trade_route" ? values.tradeRouteEnd : undefined;

  const { data, error } = await client
    .rpc("set_per_target_bulk_assignment", {
      p_assignment_type: values.assignmentType,
      p_settlement_id: values.settlementId,
      p_target_count: values.targetCount,
      p_target_id: values.targetId,
      p_trade_route_end: tradeRouteEnd,
    })
    .maybeSingle<RpcResultRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new PerTargetBulkAssignmentMutationError({
      code: "per_target_bulk_assignment_failed",
      message: "Per-target bulk assignment returned no result.",
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
      new PerTargetBulkAssignmentMutationError({
        code: "per_target_bulk_assignment_input_invalid",
        issues,
        message: "Per-target bulk assignment input is invalid.",
      }),
  );
}
