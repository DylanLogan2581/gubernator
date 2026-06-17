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
  hardDeleteConstructionProjectInputSchema,
  type HardDeleteConstructionProjectInput,
} from "../schemas/hardDeleteConstructionProjectSchemas";

import type { HardDeleteConstructionProjectResult } from "../types/constructionProjectTypes";
import type { z } from "zod";

type HardDeleteConstructionProjectMutationErrorCode =
  | "hard_delete_construction_project_input_invalid"
  | "hard_delete_construction_project_not_authorized"
  | "hard_delete_construction_project_not_found"
  | "hard_delete_construction_project_not_cancelled";

export type HardDeleteConstructionProjectMutationIssue = MutationIssue;

export const {
  ErrorClass: HardDeleteConstructionProjectMutationError,
  isError: isHardDeleteConstructionProjectMutationError,
} = createMutationError<HardDeleteConstructionProjectMutationErrorCode>(
  "HardDeleteConstructionProjectMutationError",
);
export type HardDeleteConstructionProjectMutationError = InstanceType<
  typeof HardDeleteConstructionProjectMutationError
>;

type HardDeleteConstructionProjectMutationOptions = UseMutationOptions<
  HardDeleteConstructionProjectResult,
  Error,
  HardDeleteConstructionProjectInput
>;

export function hardDeleteConstructionProjectMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
  settlementId,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): HardDeleteConstructionProjectMutationOptions {
  return mutationOptions({
    mutationFn: (input: HardDeleteConstructionProjectInput) =>
      hardDeleteConstructionProject(client, input),
    mutationKey: [
      ...buildingsQueryKeys.all,
      "hard-delete-construction-project",
    ],
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

async function hardDeleteConstructionProject(
  client: GubernatorSupabaseClient,
  input: HardDeleteConstructionProjectInput,
): Promise<HardDeleteConstructionProjectResult> {
  const values = parseInput(hardDeleteConstructionProjectInputSchema, input);

  const { data, error } = await client
    .rpc("hard_delete_construction_project", {
      p_project_id: values.projectId,
    })
    .maybeSingle<{
      readonly project_id: string;
      readonly success: boolean;
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new HardDeleteConstructionProjectMutationError({
        code: "hard_delete_construction_project_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new HardDeleteConstructionProjectMutationError({
        code: "hard_delete_construction_project_not_found",
        message: "Construction project not found.",
      });
    }
    if (error.code === "P0001") {
      throw new HardDeleteConstructionProjectMutationError({
        code: "hard_delete_construction_project_not_cancelled",
        message: "Construction project is not cancelled.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new HardDeleteConstructionProjectMutationError({
      code: "hard_delete_construction_project_not_found",
      message: "Construction project not found.",
    });
  }

  return {
    projectId: data.project_id,
    success: data.success,
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
      new HardDeleteConstructionProjectMutationError({
        code: "hard_delete_construction_project_input_invalid",
        issues,
        message: "Hard delete construction project input is invalid.",
      }),
  );
}
