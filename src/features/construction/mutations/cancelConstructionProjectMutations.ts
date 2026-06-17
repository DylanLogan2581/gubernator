import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import { buildingsQueryKeys } from "@/features/buildings";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import {
  cancelConstructionProjectInputSchema,
  type CancelConstructionProjectInput,
} from "../schemas/cancelConstructionProjectSchemas";

import type { CancelConstructionProjectResult } from "../types/constructionProjectTypes";
import type { z } from "zod";

type CancelConstructionProjectMutationErrorCode =
  | "cancel_construction_project_already_terminal"
  | "cancel_construction_project_input_invalid"
  | "cancel_construction_project_not_authorized"
  | "cancel_construction_project_not_found";

export type CancelConstructionProjectMutationIssue = MutationIssue;

export const {
  ErrorClass: CancelConstructionProjectMutationError,
  isError: isCancelConstructionProjectMutationError,
} = createMutationError<CancelConstructionProjectMutationErrorCode>(
  "CancelConstructionProjectMutationError",
);
export type CancelConstructionProjectMutationError = InstanceType<
  typeof CancelConstructionProjectMutationError
>;

type CancelConstructionProjectMutationOptions = UseMutationOptions<
  CancelConstructionProjectResult,
  Error,
  CancelConstructionProjectInput
>;

export function cancelConstructionProjectMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
  settlementId,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): CancelConstructionProjectMutationOptions {
  return mutationOptions({
    mutationFn: (input: CancelConstructionProjectInput) =>
      cancelConstructionProject(client, input),
    mutationKey: [...buildingsQueryKeys.all, "cancel-construction-project"],
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            buildingsQueryKeys.constructionProjectsBySettlement(settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["forecast"],
        }),
      ]);
    },
  });
}

async function cancelConstructionProject(
  client: GubernatorSupabaseClient,
  input: CancelConstructionProjectInput,
): Promise<CancelConstructionProjectResult> {
  const values = parseInput(cancelConstructionProjectInputSchema, input);

  const { data, error } = await client
    .rpc("cancel_construction_project", {
      p_project_id: values.projectId,
    })
    .maybeSingle<{
      readonly project_id: string;
      readonly unassigned_citizen_count: number;
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new CancelConstructionProjectMutationError({
        code: "cancel_construction_project_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new CancelConstructionProjectMutationError({
        code: "cancel_construction_project_not_found",
        message: "Construction project not found.",
      });
    }
    if (error.code === "P0001") {
      throw new CancelConstructionProjectMutationError({
        code: "cancel_construction_project_already_terminal",
        message: "Construction project is already complete or cancelled.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new CancelConstructionProjectMutationError({
      code: "cancel_construction_project_not_found",
      message: "Construction project not found.",
    });
  }

  return {
    projectId: data.project_id,
    unassignedCitizenCount: data.unassigned_citizen_count,
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
      new CancelConstructionProjectMutationError({
        code: "cancel_construction_project_input_invalid",
        issues,
        message: "Cancel construction project input is invalid.",
      }),
  );
}
