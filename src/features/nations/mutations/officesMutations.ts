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
  // #1123: fixed term length in turns. Null = indefinite, never expires.
  readonly termTurns?: number | null;
  readonly worldId: string;
};

export type DismissNationOfficeInput = {
  readonly nationId: string;
  readonly officeId: string;
  readonly worldId: string;
};

// #1123: "Renew" = re-appoint the same holder with a fresh term in place.
export type RenewNationOfficeInput = {
  readonly nationId: string;
  readonly officeId: string;
  readonly termTurns?: number | null;
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
export type RenewNationOfficeMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  RenewNationOfficeInput
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
          queryKey: nationOfficesQueryKeys.history(input.nationId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationReadinessQueryKeys.list(input.worldId),
        }),
      ]);
    },
  });
}

export function renewNationOfficeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RenewNationOfficeMutationOptions {
  return mutationOptions({
    mutationFn: (input: RenewNationOfficeInput) =>
      renewNationOffice(client, input),
    mutationKey: [...nationOfficesQueryKeys.all, "renew-nation-office"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationOfficesQueryKeys.roster(input.nationId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationOfficesQueryKeys.history(input.nationId),
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
    p_term_turns: input.termTurns ?? undefined,
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

async function renewNationOffice(
  client: GubernatorSupabaseClient,
  input: RenewNationOfficeInput,
): Promise<void> {
  const { error } = await client.rpc("renew_office", {
    p_office_id: input.officeId,
    p_term_turns: input.termTurns ?? undefined,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}

export type AppointSettlementOfficeInput = {
  readonly citizenId: string;
  // office_types.name (#1114) -- a world-default name or a nation's own
  // custom settlement office type name.
  readonly officeType: string;
  readonly settlementId: string;
  // #1123: fixed term length in turns. Null = indefinite, never expires.
  readonly termTurns?: number | null;
  readonly worldId: string;
};

export type DismissSettlementOfficeInput = {
  readonly officeId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

export type RenewSettlementOfficeInput = {
  readonly officeId: string;
  readonly settlementId: string;
  readonly termTurns?: number | null;
  readonly worldId: string;
};

export type AppointSettlementOfficeMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  AppointSettlementOfficeInput
>;
export type DismissSettlementOfficeMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  DismissSettlementOfficeInput
>;
export type RenewSettlementOfficeMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  RenewSettlementOfficeInput
>;

export function appointSettlementOfficeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): AppointSettlementOfficeMutationOptions {
  return mutationOptions({
    mutationFn: (input: AppointSettlementOfficeInput) =>
      appointSettlementOffice(client, input),
    mutationKey: [...nationOfficesQueryKeys.all, "appoint-settlement-office"],
    onSuccess: async (_result, input): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: nationOfficesQueryKeys.settlementRoster(input.settlementId),
      });
    },
  });
}

export function dismissSettlementOfficeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DismissSettlementOfficeMutationOptions {
  return mutationOptions({
    mutationFn: (input: DismissSettlementOfficeInput) =>
      dismissSettlementOffice(client, input),
    mutationKey: [...nationOfficesQueryKeys.all, "dismiss-settlement-office"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationOfficesQueryKeys.settlementRoster(input.settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationOfficesQueryKeys.settlementHistory(
            input.settlementId,
          ),
        }),
      ]);
    },
  });
}

export function renewSettlementOfficeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RenewSettlementOfficeMutationOptions {
  return mutationOptions({
    mutationFn: (input: RenewSettlementOfficeInput) =>
      renewSettlementOffice(client, input),
    mutationKey: [...nationOfficesQueryKeys.all, "renew-settlement-office"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationOfficesQueryKeys.settlementRoster(input.settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationOfficesQueryKeys.settlementHistory(
            input.settlementId,
          ),
        }),
      ]);
    },
  });
}

async function appointSettlementOffice(
  client: GubernatorSupabaseClient,
  input: AppointSettlementOfficeInput,
): Promise<void> {
  const { error } = await client.rpc("appoint_settlement_office", {
    p_citizen_id: input.citizenId,
    p_office_type: input.officeType,
    p_settlement_id: input.settlementId,
    p_term_turns: input.termTurns ?? undefined,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}

async function dismissSettlementOffice(
  client: GubernatorSupabaseClient,
  input: DismissSettlementOfficeInput,
): Promise<void> {
  const { error } = await client.rpc("dismiss_settlement_office", {
    p_office_id: input.officeId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}

async function renewSettlementOffice(
  client: GubernatorSupabaseClient,
  input: RenewSettlementOfficeInput,
): Promise<void> {
  const { error } = await client.rpc("renew_office", {
    p_office_id: input.officeId,
    p_term_turns: input.termTurns ?? undefined,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}
