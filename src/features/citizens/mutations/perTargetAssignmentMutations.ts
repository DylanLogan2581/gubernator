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
  setPerTargetAssignmentInputSchema,
  type SetPerTargetAssignmentInput,
} from "../schemas/setPerTargetAssignmentSchemas";

import type { PerTargetAssignmentResult } from "../types/bulkAssignmentTypes";
import type { z } from "zod";

type PerTargetAssignmentMutationErrorCode =
  | "per_target_assignment_failed"
  | "per_target_assignment_input_invalid";

type SetPerTargetAssignmentMutationOptions = UseMutationOptions<
  PerTargetAssignmentResult,
  AuthUiError | PerTargetAssignmentMutationError,
  SetPerTargetAssignmentInput
>;

export type PerTargetAssignmentMutationIssue = MutationIssue;

export const {
  ErrorClass: PerTargetAssignmentMutationError,
  isError: isPerTargetAssignmentMutationError,
} = createMutationError<PerTargetAssignmentMutationErrorCode>(
  "PerTargetAssignmentMutationError",
);
export type PerTargetAssignmentMutationError = InstanceType<
  typeof PerTargetAssignmentMutationError
>;

type RpcResultRow = {
  readonly assigned_count: number;
  readonly replaced_count: number;
};

export function setPerTargetAssignmentMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetPerTargetAssignmentMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetPerTargetAssignmentInput) =>
      setPerTargetAssignment(client, input),
    mutationKey: [...citizensQueryKeys.all, "set-per-target-assignment"],
    onSuccess: async (_result, input): Promise<void> => {
      const values = setPerTargetAssignmentInputSchema.parse(input);
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
      ]);
    },
  });
}

async function setPerTargetAssignment(
  client: GubernatorSupabaseClient,
  input: SetPerTargetAssignmentInput,
): Promise<PerTargetAssignmentResult> {
  const values = parseInput(setPerTargetAssignmentInputSchema, input);

  const tradeRouteEnd =
    values.assignmentType === "trade_route" ? values.tradeRouteEnd : undefined;

  const { data, error } = await client
    .rpc("set_per_target_assignment", {
      p_assignment_type: values.assignmentType,
      p_citizen_ids: values.citizenIds,
      p_settlement_id: values.settlementId,
      p_target_id: values.targetId,
      p_trade_route_end: tradeRouteEnd,
    })
    .maybeSingle<RpcResultRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new PerTargetAssignmentMutationError({
      code: "per_target_assignment_failed",
      message: "Per-target assignment returned no result.",
    });
  }

  return {
    assignedCount: data.assigned_count,
    replacedCount: data.replaced_count,
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
      new PerTargetAssignmentMutationError({
        code: "per_target_assignment_input_invalid",
        issues,
        message: "Per-target assignment input is invalid.",
      }),
  );
}
