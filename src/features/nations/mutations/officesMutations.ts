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

import { nationOfficesQueryKeys } from "../queries/nationOfficesQueryKeys";
import { nationReadinessQueryKeys } from "../queries/nationReadinessQueryKeys";

export type AppointNationOfficeInput = {
  readonly citizenId: string;
  readonly nationId: string;
  // office_types.name (#1114) -- a world-default name (e.g. "senator") or a
  // nation's own custom office type name.
  readonly officeType: string;
  readonly worldId: string;
};

export type DismissNationOfficeInput = {
  readonly nationId: string;
  readonly officeId: string;
  readonly worldId: string;
};

export type AppointNationOfficeMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  AppointNationOfficeInput
>;
export type DismissNationOfficeMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  DismissNationOfficeInput
>;

export function appointNationOfficeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): AppointNationOfficeMutationOptions {
  return mutationOptions({
    mutationFn: (input: AppointNationOfficeInput) =>
      appointNationOffice(client, input),
    mutationKey: [...nationOfficesQueryKeys.all, "appoint-nation-office"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationOfficesQueryKeys.roster(input.nationId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationReadinessQueryKeys.list(input.worldId),
        }),
      ]);
    },
  });
}

export function dismissNationOfficeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DismissNationOfficeMutationOptions {
  return mutationOptions({
    mutationFn: (input: DismissNationOfficeInput) =>
      dismissNationOffice(client, input),
    mutationKey: [...nationOfficesQueryKeys.all, "dismiss-nation-office"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationOfficesQueryKeys.roster(input.nationId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationReadinessQueryKeys.list(input.worldId),
        }),
      ]);
    },
  });
}

async function appointNationOffice(
  client: GubernatorSupabaseClient,
  input: AppointNationOfficeInput,
): Promise<void> {
  const { error } = await client.rpc("appoint_nation_office", {
    p_citizen_id: input.citizenId,
    p_nation_id: input.nationId,
    p_office_type: input.officeType,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}

async function dismissNationOffice(
  client: GubernatorSupabaseClient,
  input: DismissNationOfficeInput,
): Promise<void> {
  const { error } = await client.rpc("dismiss_nation_office", {
    p_office_id: input.officeId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}
