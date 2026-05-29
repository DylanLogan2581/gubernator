import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { citizensQueryKeys } from "@/features/citizens";
import { nationsQueryKeys } from "@/features/nations";
import { settlementsQueryKeys } from "@/features/settlements";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { permissionQueryKeys } from "../queries/permissionQueryKeys";

export type SetActivePlayerCharacterInput = {
  readonly citizenId: string;
  readonly userId: string;
  readonly worldId: string;
};

export type ClearActivePlayerCharacterInput = {
  readonly userId: string;
  readonly worldId: string;
};

type SetActivePlayerCharacterMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  SetActivePlayerCharacterInput
>;

type ClearActivePlayerCharacterMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  ClearActivePlayerCharacterInput
>;

export function setActivePlayerCharacterMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetActivePlayerCharacterMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetActivePlayerCharacterInput) =>
      setActivePlayerCharacter(client, input),
    mutationKey: [...permissionQueryKeys.all, "set-active-player-character"],
    onSuccess: (_data, input) =>
      invalidateAfterActiveCharacterChange(queryClient, input),
  });
}

export function clearActivePlayerCharacterMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): ClearActivePlayerCharacterMutationOptions {
  return mutationOptions({
    mutationFn: (input: ClearActivePlayerCharacterInput) =>
      clearActivePlayerCharacter(client, input),
    mutationKey: [...permissionQueryKeys.all, "clear-active-player-character"],
    onSuccess: (_data, input) =>
      invalidateAfterActiveCharacterChange(queryClient, input),
  });
}

async function setActivePlayerCharacter(
  client: GubernatorSupabaseClient,
  input: SetActivePlayerCharacterInput,
): Promise<void> {
  const { error } = await client.from("user_active_player_characters").upsert(
    {
      citizen_id: input.citizenId,
      user_id: input.userId,
      world_id: input.worldId,
    },
    { onConflict: "user_id,world_id" },
  );

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}

async function clearActivePlayerCharacter(
  client: GubernatorSupabaseClient,
  input: ClearActivePlayerCharacterInput,
): Promise<void> {
  const { error } = await client
    .from("user_active_player_characters")
    .delete()
    .eq("user_id", input.userId)
    .eq("world_id", input.worldId);

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}

async function invalidateAfterActiveCharacterChange(
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
    queryClient.invalidateQueries({ queryKey: citizensQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: nationsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: settlementsQueryKeys.all }),
  ]);
}
