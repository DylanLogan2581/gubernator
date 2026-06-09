import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import { buildingsQueryKeys } from "@/features/buildings";
import { citizensQueryKeys } from "@/features/citizens";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import {
  setConstructionProjectWorkersInputSchema,
  type SetConstructionProjectWorkersInput,
} from "../schemas/setConstructionProjectWorkersSchemas";

import type { SetConstructionProjectWorkersResult } from "../types/constructionProjectTypes";
import type { z } from "zod";

type SetConstructionProjectWorkersMutationErrorCode =
  | "set_workers_failed"
  | "set_workers_input_invalid"
  | "set_workers_insufficient_npcs"
  | "set_workers_not_authorized"
  | "set_workers_not_found"
  | "set_workers_terminal_project";

export type SetConstructionProjectWorkersMutationIssue = MutationIssue;

export const {
  ErrorClass: SetConstructionProjectWorkersMutationError,
  isError: isSetConstructionProjectWorkersMutationError,
} = createMutationError<SetConstructionProjectWorkersMutationErrorCode>(
  "SetConstructionProjectWorkersMutationError",
);
export type SetConstructionProjectWorkersMutationError = InstanceType<
  typeof SetConstructionProjectWorkersMutationError
>;

type SetConstructionProjectWorkersMutationOptions = UseMutationOptions<
  SetConstructionProjectWorkersResult,
  Error,
  SetConstructionProjectWorkersInput
>;

type RpcResultRow = {
  readonly after: number;
  readonly added_citizen_ids: string[];
  readonly before: number;
  readonly removed_citizen_ids: string[];
};

export function setConstructionProjectWorkersMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetConstructionProjectWorkersMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetConstructionProjectWorkersInput) =>
      setConstructionProjectWorkers(client, input),
    mutationKey: [
      ...buildingsQueryKeys.all,
      "set-construction-project-workers",
    ],
    onSuccess: async (_result, input): Promise<void> => {
      const values = setConstructionProjectWorkersInputSchema.parse(input);
      await Promise.all([
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
          queryKey: [
            ...citizensQueryKeys.all,
            "current-assignment-for-citizen",
          ],
        }),
      ]);
    },
  });
}

async function setConstructionProjectWorkers(
  client: GubernatorSupabaseClient,
  input: SetConstructionProjectWorkersInput,
): Promise<SetConstructionProjectWorkersResult> {
  const values = parseInput(setConstructionProjectWorkersInputSchema, input);

  const { data, error } = await client
    .rpc("set_construction_project_workers", {
      p_project_id: values.projectId,
      p_target_count: values.targetCount,
    })
    .maybeSingle<RpcResultRow>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new SetConstructionProjectWorkersMutationError({
        code: "set_workers_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new SetConstructionProjectWorkersMutationError({
        code: "set_workers_not_found",
        message: "Construction project not found.",
      });
    }
    if (error.code === "P0001") {
      throw new SetConstructionProjectWorkersMutationError({
        code: "set_workers_insufficient_npcs",
        message: "Insufficient unassigned NPCs available.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new SetConstructionProjectWorkersMutationError({
      code: "set_workers_failed",
      message: "Set construction project workers returned no result.",
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
      new SetConstructionProjectWorkersMutationError({
        code: "set_workers_input_invalid",
        issues,
        message: "Set construction project workers input is invalid.",
      }),
  );
}
