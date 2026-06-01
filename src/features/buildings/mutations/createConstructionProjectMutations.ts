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

import { buildingsQueryKeys } from "../queries/buildingsQueryKeys";
import {
  createConstructionProjectInputSchema,
  type CreateConstructionProjectInput,
} from "../schemas/createConstructionProjectSchemas";

import type { CreateConstructionProjectResult } from "../types/constructionProjectTypes";
import type { z } from "zod";

type ConstructionProjectMutationErrorCode =
  | "construction_project_blueprint_not_found"
  | "construction_project_blueprint_trashed"
  | "construction_project_input_invalid"
  | "construction_project_max_instances"
  | "construction_project_not_authorized"
  | "construction_project_not_found";

export type ConstructionProjectMutationIssue = MutationIssue;

export const {
  ErrorClass: ConstructionProjectMutationError,
  isError: isConstructionProjectMutationError,
} = createMutationError<ConstructionProjectMutationErrorCode>(
  "ConstructionProjectMutationError",
);
export type ConstructionProjectMutationError = InstanceType<
  typeof ConstructionProjectMutationError
>;

type CreateConstructionProjectMutationOptions = UseMutationOptions<
  CreateConstructionProjectResult,
  Error,
  CreateConstructionProjectInput
>;

export function createConstructionProjectMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateConstructionProjectMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateConstructionProjectInput) =>
      createConstructionProject(client, input),
    mutationKey: [...buildingsQueryKeys.all, "create-construction-project"],
    onSuccess: async (result): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: buildingsQueryKeys.constructionProjectsBySettlement(
          result.settlementId,
        ),
      });
    },
  });
}

async function createConstructionProject(
  client: GubernatorSupabaseClient,
  input: CreateConstructionProjectInput,
): Promise<CreateConstructionProjectResult> {
  const values = parseInput(createConstructionProjectInputSchema, input);

  const { data, error } = await client
    .rpc("create_construction_project", {
      p_blueprint_id: values.blueprintId,
      p_settlement_id: values.settlementId,
      p_target_tier_id: values.targetTierId,
    })
    .maybeSingle<{ readonly id: string; readonly settlement_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ConstructionProjectMutationError({
        code: "construction_project_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0001") {
      throw new ConstructionProjectMutationError({
        code: "construction_project_blueprint_trashed",
        message: "Blueprint is trashed.",
      });
    }
    if (error.code === "23514") {
      throw new ConstructionProjectMutationError({
        code: "construction_project_max_instances",
        message: "Maximum number of instances reached for this blueprint.",
      });
    }
    if (error.code === "P0002") {
      throw new ConstructionProjectMutationError({
        code: "construction_project_blueprint_not_found",
        message: "Settlement, blueprint, or tier not found.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ConstructionProjectMutationError({
      code: "construction_project_not_found",
      message: "Construction project could not be created.",
    });
  }

  return { projectId: data.id, settlementId: data.settlement_id };
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new ConstructionProjectMutationError({
        code: "construction_project_input_invalid",
        issues,
        message: "Construction project input is invalid.",
      }),
  );
}
