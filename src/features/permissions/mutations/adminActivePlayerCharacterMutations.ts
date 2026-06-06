import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import { createMutationError } from "@/lib/mutationError";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { permissionQueryKeys } from "../queries/permissionQueryKeys";
import { superadminQueryKeys } from "../queries/superadminQueryKeys";

type AdminActivePlayerCharacterErrorCode =
  | "admin_apc_not_authorized"
  | "admin_apc_validation_failed"
  | "admin_apc_not_found";

export const {
  ErrorClass: AdminActivePlayerCharacterMutationError,
  isError: isAdminActivePlayerCharacterMutationError,
} = createMutationError<AdminActivePlayerCharacterErrorCode>(
  "AdminActivePlayerCharacterMutationError",
);
export type AdminActivePlayerCharacterMutationError = InstanceType<
  typeof AdminActivePlayerCharacterMutationError
>;

type MutationFactoryOpts = {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
};

export type AdminSetActivePlayerCharacterInput = {
  readonly citizenId: string;
  readonly userId: string;
  readonly worldId: string;
};

export type AdminClearActivePlayerCharacterInput = {
  readonly userId: string;
  readonly worldId: string;
};

export function adminSetUserActivePlayerCharacterMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  void,
  AdminActivePlayerCharacterMutationError,
  AdminSetActivePlayerCharacterInput
> {
  return mutationOptions({
    mutationFn: (input) => adminSetUserActivePlayerCharacter(client, input),
    mutationKey: [
      ...superadminQueryKeys.all,
      "admin-set-active-player-character",
    ],
    onSuccess: (_data, input) =>
      invalidateAfterAdminActiveCharacterChange(queryClient, input),
  });
}

export function adminClearUserActivePlayerCharacterMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  void,
  AdminActivePlayerCharacterMutationError,
  AdminClearActivePlayerCharacterInput
> {
  return mutationOptions({
    mutationFn: (input) => adminClearUserActivePlayerCharacter(client, input),
    mutationKey: [
      ...superadminQueryKeys.all,
      "admin-clear-active-player-character",
    ],
    onSuccess: (_data, input) =>
      invalidateAfterAdminActiveCharacterChange(queryClient, input),
  });
}

async function adminSetUserActivePlayerCharacter(
  client: GubernatorSupabaseClient,
  input: AdminSetActivePlayerCharacterInput,
): Promise<void> {
  const { error } = await client.rpc("admin_set_user_active_player_character", {
    p_citizen_id: input.citizenId,
    p_user_id: input.userId,
    p_world_id: input.worldId,
  });

  if (error !== null) {
    if (error.code === "42501") {
      throw new AdminActivePlayerCharacterMutationError({
        code: "admin_apc_not_authorized",
        message: "Superadmin privileges are required.",
      });
    }
    if (error.code === "P0001") {
      throw new AdminActivePlayerCharacterMutationError({
        code: "admin_apc_validation_failed",
        message: error.message,
      });
    }
    if (error.code === "P0002") {
      throw new AdminActivePlayerCharacterMutationError({
        code: "admin_apc_not_found",
        message: error.message,
      });
    }
    throw normalizeSupabaseError(error);
  }
}

async function adminClearUserActivePlayerCharacter(
  client: GubernatorSupabaseClient,
  input: AdminClearActivePlayerCharacterInput,
): Promise<void> {
  const { error } = await client.rpc(
    "admin_clear_user_active_player_character",
    {
      p_user_id: input.userId,
      p_world_id: input.worldId,
    },
  );

  if (error !== null) {
    if (error.code === "42501") {
      throw new AdminActivePlayerCharacterMutationError({
        code: "admin_apc_not_authorized",
        message: "Superadmin privileges are required.",
      });
    }
    throw normalizeSupabaseError(error);
  }
}

async function invalidateAfterAdminActiveCharacterChange(
  queryClient: QueryClient,
  input: { readonly userId: string; readonly worldId: string },
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: permissionQueryKeys.activePlayerCharacterRow(
        input.userId,
        input.worldId,
      ),
    }),
    queryClient.invalidateQueries({
      queryKey: permissionQueryKeys.selectablePlayerCharacters(
        input.userId,
        input.worldId,
      ),
    }),
    queryClient.invalidateQueries({
      queryKey: superadminQueryKeys.userActivePlayerCharacterRows(input.userId),
    }),
  ]);
}
