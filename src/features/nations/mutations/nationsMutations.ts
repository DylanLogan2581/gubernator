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

import { nationsQueryKeys } from "../queries/nationsQueryKeys";
import {
  createNationInputSchema,
  deleteNationInputSchema,
  setNationHiddenInputSchema,
  updateNationDetailsInputSchema,
  type CreateNationInput,
  type DeleteNationInput,
  type SetNationHiddenInput,
  type UpdateNationDetailsInput,
} from "../schemas/nationSchemas";

import type { Nation } from "../types/nationTypes";
import type { z } from "zod";

type NationMutationErrorCode = "nation_input_invalid" | "nation_not_found";
type CreateNationMutationOptions = UseMutationOptions<
  Nation,
  AuthUiError | NationMutationError,
  CreateNationInput
>;
type UpdateNationDetailsMutationOptions = UseMutationOptions<
  Nation,
  AuthUiError | NationMutationError,
  UpdateNationDetailsInput
>;
type SetNationHiddenMutationOptions = UseMutationOptions<
  Nation,
  AuthUiError | NationMutationError,
  SetNationHiddenInput
>;
type DeleteNationMutationOptions = UseMutationOptions<
  DeleteNationResult,
  AuthUiError | NationMutationError,
  DeleteNationInput
>;

type NationRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly is_hidden: boolean;
  readonly name: string;
  readonly nameset_id: string | null;
  readonly updated_at: string;
  readonly world_id: string;
};

export type DeleteNationResult = {
  readonly nationId: string;
  readonly worldId: string;
};

const NATION_SELECT =
  "id,world_id,name,description,is_hidden,nameset_id,created_at,updated_at";

export type NationMutationIssue = MutationIssue;

export const {
  ErrorClass: NationMutationError,
  isError: isNationMutationError,
} = createMutationError<NationMutationErrorCode>("NationMutationError");
export type NationMutationError = InstanceType<typeof NationMutationError>;

export function createNationMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateNationMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateNationInput) => createNation(client, input),
    mutationKey: [...nationsQueryKeys.all, "create-nation"],
    onSuccess: async (nation): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: nationsQueryKeys.list(nation.worldId),
      });
    },
  });
}

export function updateNationDetailsMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateNationDetailsMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateNationDetailsInput) =>
      updateNationDetails(client, input),
    mutationKey: [...nationsQueryKeys.all, "update-nation-details"],
    onSuccess: async (nation): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.list(nation.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.detail(nation.id),
        }),
      ]);
    },
  });
}

export function setNationHiddenMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetNationHiddenMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetNationHiddenInput) => setNationHidden(client, input),
    mutationKey: [...nationsQueryKeys.all, "set-nation-hidden"],
    onSuccess: async (nation): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.list(nation.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.detail(nation.id),
        }),
      ]);
    },
  });
}

export function deleteNationMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteNationMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteNationInput) => deleteNation(client, input),
    mutationKey: [...nationsQueryKeys.all, "delete-nation"],
    onSuccess: async (result): Promise<void> => {
      queryClient.removeQueries({
        queryKey: nationsQueryKeys.detail(result.nationId),
      });
      queryClient.removeQueries({
        queryKey: nationsQueryKeys.settlements(result.nationId),
      });
      await queryClient.invalidateQueries({
        queryKey: nationsQueryKeys.list(result.worldId),
      });
    },
  });
}

async function createNation(
  client: GubernatorSupabaseClient,
  input: CreateNationInput,
): Promise<Nation> {
  const values = parseInput(createNationInputSchema, input);

  const { data, error } = await client
    .from("nations")
    .insert({
      description: values.description ?? null,
      is_hidden: values.isHidden ?? false,
      name: values.name.trim(),
      world_id: values.worldId,
    })
    .select(NATION_SELECT)
    .maybeSingle<NationRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NationMutationError({
      code: "nation_not_found",
      message: "Nation could not be created.",
    });
  }

  return toNation(data);
}

async function updateNationDetails(
  client: GubernatorSupabaseClient,
  input: UpdateNationDetailsInput,
): Promise<Nation> {
  const values = parseInput(updateNationDetailsInputSchema, input);

  const { data, error } = await client
    .from("nations")
    .update({
      description: values.description ?? null,
      name: values.name.trim(),
    })
    .eq("id", values.nationId)
    .eq("world_id", values.worldId)
    .select(NATION_SELECT)
    .maybeSingle<NationRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NationMutationError({
      code: "nation_not_found",
      message: "Nation could not be updated.",
    });
  }

  return toNation(data);
}

async function setNationHidden(
  client: GubernatorSupabaseClient,
  input: SetNationHiddenInput,
): Promise<Nation> {
  const values = parseInput(setNationHiddenInputSchema, input);

  const { data, error } = await client
    .from("nations")
    .update({ is_hidden: values.isHidden })
    .eq("id", values.nationId)
    .eq("world_id", values.worldId)
    .select(NATION_SELECT)
    .maybeSingle<NationRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NationMutationError({
      code: "nation_not_found",
      message: "Nation visibility could not be updated.",
    });
  }

  return toNation(data);
}

async function deleteNation(
  client: GubernatorSupabaseClient,
  input: DeleteNationInput,
): Promise<DeleteNationResult> {
  const values = parseInput(deleteNationInputSchema, input);

  const { data, error } = await client
    .from("nations")
    .delete()
    .eq("id", values.nationId)
    .eq("world_id", values.worldId)
    .select("id,world_id")
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NationMutationError({
      code: "nation_not_found",
      message: "Nation could not be deleted.",
    });
  }

  return { nationId: data.id, worldId: data.world_id };
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new NationMutationError({
        code: "nation_input_invalid",
        issues,
        message: "Nation input is invalid.",
      }),
  );
}

function toNation(row: NationRow): Nation {
  return {
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    isHidden: row.is_hidden,
    name: row.name,
    namesetId: row.nameset_id,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
