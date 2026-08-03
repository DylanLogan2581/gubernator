import {
  mutationOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import { createMutationError } from "@/lib/mutationError";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { worldQueryKeys } from "../queries/worldQueryKeys";
import {
  createWorldInputSchema,
  hardDeleteWorldInputSchema,
  restoreWorldInputSchema,
  trashWorldInputSchema,
  type CreateWorldInput,
  type HardDeleteWorldInput,
  type RestoreWorldInput,
  type TrashWorldInput,
} from "../schemas/worldAdminSchemas";

import {
  makeOpts,
  type MutationFactoryOpts,
  type WorldRow,
} from "./worldMutationShared";

type WorldAdminErrorCode =
  | "world_admin_input_invalid"
  | "world_admin_not_authorized"
  | "world_admin_not_found";

export const { ErrorClass: WorldAdminError, isError: isWorldAdminError } =
  createMutationError<WorldAdminErrorCode>("WorldAdminError");
export type WorldAdminError = InstanceType<typeof WorldAdminError>;

export function createWorldMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<WorldRow, Error, CreateWorldInput> {
  return mutationOptions({
    mutationFn: (input: CreateWorldInput) => createWorld(client, input),
    mutationKey: [...worldQueryKeys.all, "create-world"],
    ...makeOpts(queryClient),
  });
}

export function trashWorldMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  { readonly worldId: string },
  Error,
  TrashWorldInput
> {
  return mutationOptions({
    mutationFn: (input: TrashWorldInput) => trashWorld(client, input),
    mutationKey: [...worldQueryKeys.all, "trash-world"],
    ...makeOpts(queryClient),
  });
}

export function restoreWorldMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  { readonly worldId: string },
  Error,
  RestoreWorldInput
> {
  return mutationOptions({
    mutationFn: (input: RestoreWorldInput) => restoreWorld(client, input),
    mutationKey: [...worldQueryKeys.all, "restore-world"],
    ...makeOpts(queryClient),
  });
}

export function hardDeleteWorldMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  { readonly worldId: string },
  Error,
  HardDeleteWorldInput
> {
  return mutationOptions({
    mutationFn: (input: HardDeleteWorldInput) => hardDeleteWorld(client, input),
    mutationKey: [...worldQueryKeys.all, "hard-delete-world"],
    ...makeOpts(queryClient),
  });
}

async function createWorld(
  client: GubernatorSupabaseClient,
  input: CreateWorldInput,
): Promise<WorldRow> {
  const values = createWorldInputSchema.parse(input);

  const { data, error } = await client
    .rpc("create_world", {
      p_name: values.name.trim(),
    })
    .maybeSingle<WorldRow>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new WorldAdminError({
        code: "world_admin_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new WorldAdminError({
      code: "world_admin_not_found",
      message: "World could not be created.",
    });
  }

  return data;
}

async function trashWorld(
  client: GubernatorSupabaseClient,
  input: TrashWorldInput,
): Promise<{ readonly worldId: string }> {
  const values = trashWorldInputSchema.parse(input);

  const { data, error } = await client
    .rpc("trash_world", { p_world_id: values.worldId })
    .maybeSingle<{ readonly id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new WorldAdminError({
        code: "world_admin_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new WorldAdminError({
      code: "world_admin_not_found",
      message: "World could not be trashed.",
    });
  }

  return { worldId: data.id };
}

async function restoreWorld(
  client: GubernatorSupabaseClient,
  input: RestoreWorldInput,
): Promise<{ readonly worldId: string }> {
  const values = restoreWorldInputSchema.parse(input);

  const { data, error } = await client
    .rpc("restore_world", { p_world_id: values.worldId })
    .maybeSingle<{ readonly id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new WorldAdminError({
        code: "world_admin_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new WorldAdminError({
      code: "world_admin_not_found",
      message: "World could not be restored.",
    });
  }

  return { worldId: data.id };
}

async function hardDeleteWorld(
  client: GubernatorSupabaseClient,
  input: HardDeleteWorldInput,
): Promise<{ readonly worldId: string }> {
  const values = hardDeleteWorldInputSchema.parse(input);

  const { data, error } = await client
    .rpc("hard_delete_world", { p_world_id: values.worldId })
    .maybeSingle<{ readonly id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new WorldAdminError({
        code: "world_admin_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new WorldAdminError({
      code: "world_admin_not_found",
      message: "World could not be permanently deleted.",
    });
  }

  return { worldId: data.id };
}
