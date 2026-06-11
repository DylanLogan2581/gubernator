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
  reorderConstructionProjectsInputSchema,
  type ReorderConstructionProjectsInput,
} from "../schemas/reorderConstructionProjectsSchemas";

import type { ReorderConstructionProjectsResult } from "../types/constructionProjectTypes";
import type { z } from "zod";

type ReorderConstructionProjectsMutationErrorCode =
  | "reorder_construction_projects_input_invalid"
  | "reorder_construction_projects_not_authorized"
  | "reorder_construction_projects_not_found"
  | "reorder_construction_projects_positions_invalid";

export type ReorderConstructionProjectsMutationIssue = MutationIssue;

export const {
  ErrorClass: ReorderConstructionProjectsMutationError,
  isError: isReorderConstructionProjectsMutationError,
} = createMutationError<ReorderConstructionProjectsMutationErrorCode>(
  "ReorderConstructionProjectsMutationError",
);
export type ReorderConstructionProjectsMutationError = InstanceType<
  typeof ReorderConstructionProjectsMutationError
>;

type ReorderConstructionProjectsMutationOptions = UseMutationOptions<
  ReorderConstructionProjectsResult,
  Error,
  ReorderConstructionProjectsInput
>;

export function reorderConstructionProjectsMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): ReorderConstructionProjectsMutationOptions {
  return mutationOptions({
    mutationFn: (input: ReorderConstructionProjectsInput) =>
      reorderConstructionProjects(client, input),
    mutationKey: [...buildingsQueryKeys.all, "reorder-construction-projects"],
    onSuccess: async (_, input): Promise<void> => {
      const values = reorderConstructionProjectsInputSchema.safeParse(input);
      if (values.success) {
        await queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.constructionProjectsBySettlement(
            values.data.settlementId,
          ),
        });
      }
    },
  });
}

async function reorderConstructionProjects(
  client: GubernatorSupabaseClient,
  input: ReorderConstructionProjectsInput,
): Promise<ReorderConstructionProjectsResult> {
  const values = parseInput(reorderConstructionProjectsInputSchema, input);

  const { data, error } = await client
    .rpc("reorder_construction_projects", {
      p_positions: values.positions.map((p) => ({
        position: p.position,
        projectId: p.projectId,
      })),
      p_settlement_id: values.settlementId,
    })
    .maybeSingle<{ readonly updated_count: number }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ReorderConstructionProjectsMutationError({
        code: "reorder_construction_projects_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new ReorderConstructionProjectsMutationError({
        code: "reorder_construction_projects_not_found",
        message: "Settlement not found.",
      });
    }
    if (error.code === "P0001") {
      throw new ReorderConstructionProjectsMutationError({
        code: "reorder_construction_projects_positions_invalid",
        message: "Positions list is invalid.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ReorderConstructionProjectsMutationError({
      code: "reorder_construction_projects_not_found",
      message: "Settlement not found.",
    });
  }

  return { updatedCount: data.updated_count };
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new ReorderConstructionProjectsMutationError({
        code: "reorder_construction_projects_input_invalid",
        issues,
        message: "Reorder construction projects input is invalid.",
      }),
  );
}
