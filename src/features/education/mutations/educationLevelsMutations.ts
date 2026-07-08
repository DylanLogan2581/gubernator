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

import {
  EDUCATION_LEVEL_SELECT,
  toEducationLevel,
  type EducationLevelRow,
} from "../queries/educationLevelRow";
import { educationLevelsQueryKeys } from "../queries/educationLevelsQueryKeys";
import {
  createEducationLevelInputSchema,
  deleteEducationLevelInputSchema,
  reorderEducationLevelInputSchema,
  updateEducationLevelInputSchema,
  type CreateEducationLevelInput,
  type DeleteEducationLevelInput,
  type ReorderEducationLevelInput,
  type UpdateEducationLevelInput,
} from "../schemas/educationLevelSchemas";

import type { EducationLevel } from "../types/educationLevelTypes";
import type { z } from "zod";

type EducationLevelMutationErrorCode =
  | "education_level_forbidden"
  | "education_level_in_use"
  | "education_level_input_invalid"
  | "education_level_name_taken"
  | "education_level_not_found"
  | "education_level_no_adjacent";

export type EducationLevelMutationIssue = MutationIssue;

export const {
  ErrorClass: EducationLevelMutationError,
  isError: isEducationLevelMutationError,
} = createMutationError<EducationLevelMutationErrorCode>(
  "EducationLevelMutationError",
);
export type EducationLevelMutationError = InstanceType<
  typeof EducationLevelMutationError
>;

export type DeleteEducationLevelResult = {
  readonly educationLevelId: string;
  readonly worldId: string;
};

type CreateEducationLevelMutationOptions = UseMutationOptions<
  EducationLevel,
  AuthUiError | EducationLevelMutationError,
  CreateEducationLevelInput
>;
type UpdateEducationLevelMutationOptions = UseMutationOptions<
  EducationLevel,
  AuthUiError | EducationLevelMutationError,
  UpdateEducationLevelInput
>;
type DeleteEducationLevelMutationOptions = UseMutationOptions<
  DeleteEducationLevelResult,
  AuthUiError | EducationLevelMutationError,
  DeleteEducationLevelInput
>;
type ReorderEducationLevelMutationOptions = UseMutationOptions<
  readonly EducationLevel[],
  AuthUiError | EducationLevelMutationError,
  ReorderEducationLevelInput
>;

export function createEducationLevelMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateEducationLevelMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateEducationLevelInput) =>
      createEducationLevel(client, input),
    mutationKey: [...educationLevelsQueryKeys.all, "create-education-level"],
    onSuccess: async (educationLevel): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: educationLevelsQueryKeys.byWorld(educationLevel.worldId),
      });
    },
  });
}

export function updateEducationLevelMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateEducationLevelMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateEducationLevelInput) =>
      updateEducationLevel(client, input),
    mutationKey: [...educationLevelsQueryKeys.all, "update-education-level"],
    onSuccess: async (educationLevel): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: educationLevelsQueryKeys.byWorld(educationLevel.worldId),
      });
    },
  });
}

export function deleteEducationLevelMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteEducationLevelMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteEducationLevelInput) =>
      deleteEducationLevel(client, input),
    mutationKey: [...educationLevelsQueryKeys.all, "delete-education-level"],
    onSuccess: async (result): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: educationLevelsQueryKeys.byWorld(result.worldId),
      });
    },
  });
}

export function reorderEducationLevelMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): ReorderEducationLevelMutationOptions {
  return mutationOptions({
    mutationFn: (input: ReorderEducationLevelInput) =>
      reorderEducationLevel(client, input),
    mutationKey: [...educationLevelsQueryKeys.all, "reorder-education-level"],
    onSuccess: async (_, input): Promise<void> => {
      const values = reorderEducationLevelInputSchema.safeParse(input);
      if (values.success) {
        await queryClient.invalidateQueries({
          queryKey: educationLevelsQueryKeys.byWorld(values.data.worldId),
        });
      }
    },
  });
}

async function createEducationLevel(
  client: GubernatorSupabaseClient,
  input: CreateEducationLevelInput,
): Promise<EducationLevel> {
  const values = parseInput(createEducationLevelInputSchema, input);

  // Rank is server-computed (appended to the end of the ladder) rather than
  // client-supplied, so creation goes through an RPC instead of a raw table
  // insert -- see create_education_level in the education_levels migration.
  const { data, error } = await client
    .rpc("create_education_level", {
      // Generated types don't reflect the nullable parameter; the DB column
      // permits null descriptions.
      p_description: (values.description ?? null) as string,
      p_name: values.name.trim(),
      p_world_id: values.worldId,
    })
    .maybeSingle<EducationLevelRow>();

  if (error !== null) {
    throw translateEducationLevelError(error);
  }

  if (data === null) {
    throw new EducationLevelMutationError({
      code: "education_level_not_found",
      message: "Education level could not be created.",
    });
  }

  return toEducationLevel(data);
}

async function updateEducationLevel(
  client: GubernatorSupabaseClient,
  input: UpdateEducationLevelInput,
): Promise<EducationLevel> {
  const values = parseInput(updateEducationLevelInputSchema, input);

  const updatePayload: {
    description?: string | null;
    name?: string;
  } = {};

  if (values.name !== undefined) {
    updatePayload.name = values.name.trim();
  }
  if (values.description !== undefined) {
    updatePayload.description = values.description;
  }

  const { data, error } = await client
    .from("education_levels")
    .update(updatePayload)
    .eq("id", values.educationLevelId)
    .eq("world_id", values.worldId)
    .select(EDUCATION_LEVEL_SELECT)
    .maybeSingle<EducationLevelRow>();

  if (error !== null) {
    throw translateEducationLevelError(error);
  }

  if (data === null) {
    throw new EducationLevelMutationError({
      code: "education_level_not_found",
      message: "Education level could not be updated.",
    });
  }

  return toEducationLevel(data);
}

async function deleteEducationLevel(
  client: GubernatorSupabaseClient,
  input: DeleteEducationLevelInput,
): Promise<DeleteEducationLevelResult> {
  const values = parseInput(deleteEducationLevelInputSchema, input);

  const { data, error } = await client
    .from("education_levels")
    .delete()
    .eq("id", values.educationLevelId)
    .eq("world_id", values.worldId)
    .select("id,world_id")
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    throw translateEducationLevelError(error);
  }

  if (data === null) {
    throw new EducationLevelMutationError({
      code: "education_level_not_found",
      message: "Education level could not be deleted.",
    });
  }

  return { educationLevelId: data.id, worldId: data.world_id };
}

async function reorderEducationLevel(
  client: GubernatorSupabaseClient,
  input: ReorderEducationLevelInput,
): Promise<readonly EducationLevel[]> {
  const values = parseInput(reorderEducationLevelInputSchema, input);

  const { data, error } = await client.rpc("reorder_education_level", {
    p_direction: values.direction,
    p_level_id: values.educationLevelId,
  });

  if (error !== null) {
    if (error.code === "42501") {
      throw new EducationLevelMutationError({
        code: "education_level_forbidden",
        message: "You do not have permission to manage education levels.",
      });
    }
    if (error.code === "P0001") {
      throw new EducationLevelMutationError({
        code: "education_level_no_adjacent",
        message: "There is no adjacent education level to swap with.",
      });
    }
    if (error.code === "P0002") {
      throw new EducationLevelMutationError({
        code: "education_level_not_found",
        message: "Education level could not be found.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  return data.map(toEducationLevel);
}

function translateEducationLevelError(error: {
  readonly code?: string | null;
  readonly message: string;
}): Error {
  if (error.code === "23505") {
    return new EducationLevelMutationError({
      code: "education_level_name_taken",
      message: "An education level with this name already exists.",
    });
  }
  if (error.code === "23503") {
    return new EducationLevelMutationError({
      code: "education_level_in_use",
      message: "This education level is still in use and cannot be deleted.",
    });
  }
  if (error.code === "42501") {
    return new EducationLevelMutationError({
      code: "education_level_forbidden",
      message: "You do not have permission to manage education levels.",
    });
  }
  return normalizeSupabaseError(error);
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new EducationLevelMutationError({
        code: "education_level_input_invalid",
        issues,
        message: "Education level input is invalid.",
      }),
  );
}
