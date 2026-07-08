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
  RELIGION_SELECT,
  toReligion,
  type ReligionRow,
} from "../queries/religionRow";
import { religionsQueryKeys } from "../queries/religionsQueryKeys";
import {
  createReligionInputSchema,
  deleteReligionInputSchema,
  updateReligionInputSchema,
  type CreateReligionInput,
  type DeleteReligionInput,
  type UpdateReligionInput,
} from "../schemas/religionSchemas";

import type { Religion } from "../types/religionTypes";
import type { z } from "zod";

type ReligionMutationErrorCode =
  | "religion_forbidden"
  | "religion_input_invalid"
  | "religion_name_taken"
  | "religion_not_found";

export type ReligionMutationIssue = MutationIssue;

export const {
  ErrorClass: ReligionMutationError,
  isError: isReligionMutationError,
} = createMutationError<ReligionMutationErrorCode>("ReligionMutationError");
export type ReligionMutationError = InstanceType<typeof ReligionMutationError>;

export type DeleteReligionResult = {
  readonly religionId: string;
  readonly worldId: string;
};

type CreateReligionMutationOptions = UseMutationOptions<
  Religion,
  AuthUiError | ReligionMutationError,
  CreateReligionInput
>;
type UpdateReligionMutationOptions = UseMutationOptions<
  Religion,
  AuthUiError | ReligionMutationError,
  UpdateReligionInput
>;
type DeleteReligionMutationOptions = UseMutationOptions<
  DeleteReligionResult,
  AuthUiError | ReligionMutationError,
  DeleteReligionInput
>;

export function createReligionMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateReligionMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateReligionInput) => createReligion(client, input),
    mutationKey: [...religionsQueryKeys.all, "create-religion"],
    onSuccess: async (religion): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: religionsQueryKeys.byWorld(religion.worldId),
      });
    },
  });
}

export function updateReligionMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateReligionMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateReligionInput) => updateReligion(client, input),
    mutationKey: [...religionsQueryKeys.all, "update-religion"],
    onSuccess: async (religion): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: religionsQueryKeys.byWorld(religion.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: religionsQueryKeys.detail(religion.id),
        }),
      ]);
    },
  });
}

export function deleteReligionMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteReligionMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteReligionInput) => deleteReligion(client, input),
    mutationKey: [...religionsQueryKeys.all, "delete-religion"],
    onSuccess: async (result): Promise<void> => {
      queryClient.removeQueries({
        queryKey: religionsQueryKeys.detail(result.religionId),
      });
      await queryClient.invalidateQueries({
        queryKey: religionsQueryKeys.byWorld(result.worldId),
      });
    },
  });
}

async function createReligion(
  client: GubernatorSupabaseClient,
  input: CreateReligionInput,
): Promise<Religion> {
  const values = parseInput(createReligionInputSchema, input);

  const { data, error } = await client
    .from("religions")
    .insert({
      color: values.color,
      description: values.description ?? null,
      name: values.name.trim(),
      world_id: values.worldId,
    })
    .select(RELIGION_SELECT)
    .maybeSingle<ReligionRow>();

  if (error !== null) {
    throw translateReligionError(error);
  }

  if (data === null) {
    throw new ReligionMutationError({
      code: "religion_not_found",
      message: "Religion could not be created.",
    });
  }

  return toReligion(data);
}

async function updateReligion(
  client: GubernatorSupabaseClient,
  input: UpdateReligionInput,
): Promise<Religion> {
  const values = parseInput(updateReligionInputSchema, input);

  const updatePayload: {
    color?: string;
    description?: string | null;
    name?: string;
  } = {};

  if (values.name !== undefined) {
    updatePayload.name = values.name.trim();
  }
  if (values.description !== undefined) {
    updatePayload.description = values.description;
  }
  if (values.color !== undefined) {
    updatePayload.color = values.color;
  }

  const { data, error } = await client
    .from("religions")
    .update(updatePayload)
    .eq("id", values.religionId)
    .eq("world_id", values.worldId)
    .select(RELIGION_SELECT)
    .maybeSingle<ReligionRow>();

  if (error !== null) {
    throw translateReligionError(error);
  }

  if (data === null) {
    throw new ReligionMutationError({
      code: "religion_not_found",
      message: "Religion could not be updated.",
    });
  }

  return toReligion(data);
}

async function deleteReligion(
  client: GubernatorSupabaseClient,
  input: DeleteReligionInput,
): Promise<DeleteReligionResult> {
  const values = parseInput(deleteReligionInputSchema, input);

  const { data, error } = await client
    .from("religions")
    .delete()
    .eq("id", values.religionId)
    .eq("world_id", values.worldId)
    .select("id,world_id")
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    throw translateReligionError(error);
  }

  if (data === null) {
    throw new ReligionMutationError({
      code: "religion_not_found",
      message: "Religion could not be deleted.",
    });
  }

  return { religionId: data.id, worldId: data.world_id };
}

function translateReligionError(error: {
  readonly code?: string | null;
  readonly message: string;
}): Error {
  if (error.code === "23505") {
    return new ReligionMutationError({
      code: "religion_name_taken",
      message: "A religion with this name already exists.",
    });
  }
  if (error.code === "42501") {
    return new ReligionMutationError({
      code: "religion_forbidden",
      message: "You do not have permission to manage religions.",
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
      new ReligionMutationError({
        code: "religion_input_invalid",
        issues,
        message: "Religion input is invalid.",
      }),
  );
}
