import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { nationsQueryKeys } from "./nationsQueryKeys";

import type {
  NationCurrency,
  NationCurrencyLedgerEntry,
  NationCurrencySnapshot,
  NationCurrencyType,
} from "../types/currencyTypes";

// ---------------------------------------------------------------------------
// nation_currencies (one per nation, or none before it is established)
// ---------------------------------------------------------------------------

type NationCurrencyQueryKey = ReturnType<typeof nationsQueryKeys.currency>;
type NationCurrencyQueryOptions = UseQueryOptions<
  NationCurrency | null,
  AuthUiError,
  NationCurrency | null,
  NationCurrencyQueryKey
>;

const CURRENCY_SELECT =
  "id,world_id,nation_id,name,symbol,currency_type,backing_resource_id,backing_ratio,money_supply,reserve_quantity,confidence,established_turn_number";

type CurrencyRow = {
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
};

function toCurrency(row: CurrencyRow): NationCurrency {
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

export function nationCurrencyQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationCurrencyQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getNationCurrency(c, nationId),
    queryKey: nationsQueryKeys.currency(nationId),
  });
}

async function getNationCurrency(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<NationCurrency | null> {
  const { data, error } = await client
    .from("nation_currencies")
    .select(CURRENCY_SELECT)
    .eq("nation_id", nationId)
    .maybeSingle<CurrencyRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toCurrency(data);
}

// ---------------------------------------------------------------------------
// nations.treasury_currency (the government's own minted-currency holdings —
// tracked on the nation row, separate from nation_currencies.money_supply so
// treasury spend RPCs can debit it without touching the currency directly)
// ---------------------------------------------------------------------------

type NationCurrencyTreasuryQueryKey = ReturnType<
  typeof nationsQueryKeys.currencyTreasury
>;
type NationCurrencyTreasuryQueryOptions = UseQueryOptions<
  number,
  AuthUiError,
  number,
  NationCurrencyTreasuryQueryKey
>;

export function nationCurrencyTreasuryQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationCurrencyTreasuryQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getNationCurrencyTreasury(c, nationId),
    queryKey: nationsQueryKeys.currencyTreasury(nationId),
  });
}

async function getNationCurrencyTreasury(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<number> {
  const { data, error } = await client
    .from("nations")
    .select("treasury_currency")
    .eq("id", nationId)
    .single<{ readonly treasury_currency: number }>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.treasury_currency;
}

// ---------------------------------------------------------------------------
// nation_currency_snapshots (chronological, for sparklines)
// ---------------------------------------------------------------------------

// Enough turns for a readable trend line without an unbounded chart.
const CURRENCY_SNAPSHOT_HISTORY_LIMIT = 20;

type NationCurrencySnapshotsQueryKey = ReturnType<
  typeof nationsQueryKeys.currencySnapshots
>;
type NationCurrencySnapshotsQueryOptions = UseQueryOptions<
  readonly NationCurrencySnapshot[],
  AuthUiError,
  readonly NationCurrencySnapshot[],
  NationCurrencySnapshotsQueryKey
>;

type SnapshotRow = {
  readonly burned: number;
  readonly confidence: number;
  readonly minted: number;
  readonly money_supply: number;
  readonly reserve_quantity: number;
  readonly turn_number: number;
};

export function nationCurrencySnapshotsQueryOptions(
  currencyId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationCurrencySnapshotsQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getNationCurrencySnapshots(c, currencyId),
    queryKey: nationsQueryKeys.currencySnapshots(currencyId),
  });
}

async function getNationCurrencySnapshots(
  client: GubernatorSupabaseClient,
  currencyId: string,
): Promise<readonly NationCurrencySnapshot[]> {
  const { data, error } = await client
    .from("nation_currency_snapshots")
    .select(
      "turn_number,money_supply,reserve_quantity,confidence,minted,burned",
    )
    .eq("currency_id", currencyId)
    .order("turn_number", { ascending: false })
    .limit(CURRENCY_SNAPSHOT_HISTORY_LIMIT)
    .returns<SnapshotRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data
    .map((row) => ({
      burned: row.burned,
      confidence: row.confidence,
      minted: row.minted,
      moneySupply: row.money_supply,
      reserveQuantity: row.reserve_quantity,
      turnNumber: row.turn_number,
    }))
    .sort((a, b) => a.turnNumber - b.turnNumber);
}

// ---------------------------------------------------------------------------
// nation_currency_ledger (paginated, newest first)
// ---------------------------------------------------------------------------

export const CURRENCY_LEDGER_PAGE_SIZE = 20;

export type NationCurrencyLedgerPage = {
  readonly entries: readonly NationCurrencyLedgerEntry[];
  readonly totalCount: number;
};

type NationCurrencyLedgerPageQueryKey = ReturnType<
  typeof nationsQueryKeys.currencyLedgerPage
>;
type NationCurrencyLedgerPageQueryOptions = UseQueryOptions<
  NationCurrencyLedgerPage,
  AuthUiError,
  NationCurrencyLedgerPage,
  NationCurrencyLedgerPageQueryKey
>;

type LedgerRow = {
  readonly action: string;
  readonly actor_citizen_id: string | null;
  readonly amount: number | null;
  readonly id: string;
  readonly resource_amount: number | null;
  readonly turn_number: number;
};

export function nationCurrencyLedgerPageQueryOptions(
  currencyId: string,
  page: number,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationCurrencyLedgerPageQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getNationCurrencyLedgerPage(c, currencyId, page),
    queryKey: nationsQueryKeys.currencyLedgerPage(currencyId, page),
  });
}

async function getNationCurrencyLedgerPage(
  client: GubernatorSupabaseClient,
  currencyId: string,
  page: number,
): Promise<NationCurrencyLedgerPage> {
  const from = page * CURRENCY_LEDGER_PAGE_SIZE;
  const to = from + CURRENCY_LEDGER_PAGE_SIZE - 1;

  const { data, error, count } = await client
    .from("nation_currency_ledger")
    .select("id,action,amount,resource_amount,actor_citizen_id,turn_number", {
      count: "exact",
    })
    .eq("currency_id", currencyId)
    .order("turn_number", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to)
    .returns<LedgerRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  const actorNamesById = await getActorNamesById(
    client,
    new Set(
      data
        .map((row) => row.actor_citizen_id)
        .filter((id): id is string => id !== null),
    ),
  );

  return {
    entries: data.map((row) => ({
      action: row.action as NationCurrencyLedgerEntry["action"],
      actorCitizenId: row.actor_citizen_id,
      actorName:
        row.actor_citizen_id === null
          ? null
          : (actorNamesById.get(row.actor_citizen_id) ?? "Unknown citizen"),
      amount: row.amount,
      id: row.id,
      resourceAmount: row.resource_amount,
      turnNumber: row.turn_number,
    })),
    totalCount: count ?? 0,
  };
}

async function getActorNamesById(
  client: GubernatorSupabaseClient,
  citizenIds: ReadonlySet<string>,
): Promise<ReadonlyMap<string, string>> {
  if (citizenIds.size === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("citizen_directory_view")
    .select("id,name")
    .in("id", [...citizenIds])
    .returns<{ readonly id: string; readonly name: string }[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return new Map(data.map((row) => [row.id, row.name]));
}
