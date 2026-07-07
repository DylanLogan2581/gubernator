import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationsQueryKeys } from "../queries/nationsQueryKeys";

export type SetNationsMetInput = {
  readonly nationAId: string;
  readonly nationBId: string;
  readonly worldId: string;
};

export type SetNationsUnmetInput = SetNationsMetInput;

export type SetNationsMetMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  SetNationsMetInput
>;

export type SetNationsUnmetMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  SetNationsUnmetInput
>;

export function setNationsMetMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetNationsMetMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetNationsMetInput) => setNationsMet(client, input),
    mutationKey: [...nationsQueryKeys.all, "set-nations-met"],
    onSuccess: async (_result, input): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: nationsQueryKeys.discoveries(input.worldId),
      });
    },
  });
}

export function setNationsUnmetMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetNationsUnmetMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetNationsUnmetInput) => setNationsUnmet(client, input),
    mutationKey: [...nationsQueryKeys.all, "set-nations-unmet"],
    onSuccess: async (_result, input): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: nationsQueryKeys.discoveries(input.worldId),
      });
    },
  });
}

async function setNationsMet(
  client: GubernatorSupabaseClient,
  input: SetNationsMetInput,
): Promise<void> {
  const { error } = await client.rpc("set_nations_met", {
    p_a: input.nationAId,
    p_b: input.nationBId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}

async function setNationsUnmet(
  client: GubernatorSupabaseClient,
  input: SetNationsUnmetInput,
): Promise<void> {
  const { error } = await client.rpc("set_nations_unmet", {
    p_a: input.nationAId,
    p_b: input.nationBId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}
