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

import type {
  NationCurrency,
  NationCurrencyType,
} from "../types/currencyTypes";

export type EstablishNationCurrencyInput = {
  readonly backingRatio?: number;
  readonly backingResourceId?: string;
  readonly name: string;
  readonly nationId: string;
  readonly symbol: string;
  readonly type: NationCurrencyType;
};

export type MintCurrencyInput = {
  readonly amount: number;
  readonly currencyId: string;
  readonly nationId: string;
};

export type BurnCurrencyInput = {
  readonly amount: number;
  readonly currencyId: string;
  readonly nationId: string;
};

export type DepositReservesInput = {
  readonly currencyId: string;
  readonly nationId: string;
  readonly quantity: number;
};

export type RedeemReservesInput = {
  readonly currencyId: string;
  readonly nationId: string;
  readonly quantity: number;
};

export type EstablishNationCurrencyMutationOptions = UseMutationOptions<
  NationCurrency,
  AuthUiError,
  EstablishNationCurrencyInput
>;
export type MintCurrencyMutationOptions = UseMutationOptions<
  NationCurrency,
  AuthUiError,
  MintCurrencyInput
>;
export type BurnCurrencyMutationOptions = UseMutationOptions<
  NationCurrency,
  AuthUiError,
  BurnCurrencyInput
>;
export type DepositReservesMutationOptions = UseMutationOptions<
  NationCurrency,
  AuthUiError,
  DepositReservesInput
>;
export type RedeemReservesMutationOptions = UseMutationOptions<
  NationCurrency,
  AuthUiError,
  RedeemReservesInput
>;

function toCurrency(row: {
  readonly backing_ratio: number | null;
  readonly backing_resource_id: string | null;
  readonly confidence: number;
  readonly currency_type: string;
  readonly established_turn_number: number;
  readonly id: string;
  readonly money_supply: number;
  readonly name: string;
  readonly nation_id: string;
  readonly reserve_quantity: number;
  readonly symbol: string;
  readonly world_id: string;
}): NationCurrency {
  return {
    backingRatio: row.backing_ratio,
    backingResourceId: row.backing_resource_id,
    confidence: row.confidence,
    currencyType: row.currency_type as NationCurrencyType,
    establishedTurnNumber: row.established_turn_number,
    id: row.id,
    moneySupply: row.money_supply,
    name: row.name,
    nationId: row.nation_id,
    reserveQuantity: row.reserve_quantity,
    symbol: row.symbol,
    worldId: row.world_id,
  };
}

async function invalidateCurrency(
  queryClient: QueryClient,
  nationId: string,
  currencyId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: nationsQueryKeys.currency(nationId),
    }),
    queryClient.invalidateQueries({
      queryKey: nationsQueryKeys.currencyTreasury(nationId),
    }),
    queryClient.invalidateQueries({
      queryKey: nationsQueryKeys.currencySnapshots(currencyId),
    }),
    queryClient.invalidateQueries({
      queryKey: [...nationsQueryKeys.all, "currency-ledger-page", currencyId],
    }),
  ]);
}

export function establishNationCurrencyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): EstablishNationCurrencyMutationOptions {
  return mutationOptions({
    mutationFn: (input: EstablishNationCurrencyInput) =>
      establishNationCurrency(client, input),
    mutationKey: [...nationsQueryKeys.all, "establish-nation-currency"],
    onSuccess: async (result, input): Promise<void> => {
      await invalidateCurrency(queryClient, input.nationId, result.id);
    },
  });
}

async function establishNationCurrency(
  client: GubernatorSupabaseClient,
  input: EstablishNationCurrencyInput,
): Promise<NationCurrency> {
  const { data, error } = await client.rpc("establish_nation_currency", {
    p_backing_ratio: input.backingRatio,
    p_backing_resource_id: input.backingResourceId,
    p_name: input.name,
    p_nation_id: input.nationId,
    p_symbol: input.symbol,
    p_type: input.type,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return toCurrency(data);
}

export function mintCurrencyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): MintCurrencyMutationOptions {
  return mutationOptions({
    mutationFn: (input: MintCurrencyInput) => mintCurrency(client, input),
    mutationKey: [...nationsQueryKeys.all, "mint-currency"],
    onSuccess: async (_result, input): Promise<void> => {
      await invalidateCurrency(queryClient, input.nationId, input.currencyId);
    },
  });
}

async function mintCurrency(
  client: GubernatorSupabaseClient,
  input: MintCurrencyInput,
): Promise<NationCurrency> {
  const { data, error } = await client.rpc("mint_currency", {
    p_amount: input.amount,
    p_currency_id: input.currencyId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return toCurrency(data);
}

export function burnCurrencyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): BurnCurrencyMutationOptions {
  return mutationOptions({
    mutationFn: (input: BurnCurrencyInput) => burnCurrency(client, input),
    mutationKey: [...nationsQueryKeys.all, "burn-currency"],
    onSuccess: async (_result, input): Promise<void> => {
      await invalidateCurrency(queryClient, input.nationId, input.currencyId);
    },
  });
}

async function burnCurrency(
  client: GubernatorSupabaseClient,
  input: BurnCurrencyInput,
): Promise<NationCurrency> {
  const { data, error } = await client.rpc("burn_currency", {
    p_amount: input.amount,
    p_currency_id: input.currencyId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return toCurrency(data);
}

export function depositReservesMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DepositReservesMutationOptions {
  return mutationOptions({
    mutationFn: (input: DepositReservesInput) => depositReserves(client, input),
    mutationKey: [...nationsQueryKeys.all, "deposit-reserves"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        invalidateCurrency(queryClient, input.nationId, input.currencyId),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.treasuryStockpile(input.nationId),
        }),
      ]);
    },
  });
}

async function depositReserves(
  client: GubernatorSupabaseClient,
  input: DepositReservesInput,
): Promise<NationCurrency> {
  const { data, error } = await client.rpc("deposit_reserves", {
    p_currency_id: input.currencyId,
    p_quantity: input.quantity,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return toCurrency(data);
}

export function redeemReservesMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RedeemReservesMutationOptions {
  return mutationOptions({
    mutationFn: (input: RedeemReservesInput) => redeemReserves(client, input),
    mutationKey: [...nationsQueryKeys.all, "redeem-reserves"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        invalidateCurrency(queryClient, input.nationId, input.currencyId),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.treasuryStockpile(input.nationId),
        }),
      ]);
    },
  });
}

async function redeemReserves(
  client: GubernatorSupabaseClient,
  input: RedeemReservesInput,
): Promise<NationCurrency> {
  const { data, error } = await client.rpc("redeem_reserves", {
    p_currency_id: input.currencyId,
    p_quantity: input.quantity,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return toCurrency(data);
}
