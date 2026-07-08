// Central bank (#1095): currency established for a nation, its per-turn
// snapshot history (for sparklines), and its action ledger.
export const NATION_CURRENCY_TYPES = ["fiat", "resource_backed"] as const;

export type NationCurrencyType = (typeof NATION_CURRENCY_TYPES)[number];

export type NationCurrency = {
  readonly backingRatio: number | null;
  readonly backingResourceId: string | null;
  readonly confidence: number;
  readonly currencyType: NationCurrencyType;
  readonly establishedTurnNumber: number;
  readonly id: string;
  readonly moneySupply: number;
  readonly name: string;
  readonly nationId: string;
  readonly reserveQuantity: number;
  readonly symbol: string;
  readonly worldId: string;
};

export type NationCurrencySnapshot = {
  readonly burned: number;
  readonly confidence: number;
  readonly minted: number;
  readonly moneySupply: number;
  readonly reserveQuantity: number;
  readonly turnNumber: number;
};

export const NATION_CURRENCY_LEDGER_ACTIONS = [
  "mint",
  "burn",
  "deposit",
  "redeem",
] as const;

export type NationCurrencyLedgerAction =
  (typeof NATION_CURRENCY_LEDGER_ACTIONS)[number];

export type NationCurrencyLedgerEntry = {
  readonly action: NationCurrencyLedgerAction;
  readonly actorCitizenId: string | null;
  readonly actorName: string | null;
  readonly amount: number | null;
  readonly id: string;
  readonly resourceAmount: number | null;
  readonly turnNumber: number;
};

export function formatNationCurrencyType(type: NationCurrencyType): string {
  switch (type) {
    case "fiat":
      return "Fiat";
    case "resource_backed":
      return "Resource-backed";
  }
}

export function formatNationCurrencyLedgerAction(
  action: NationCurrencyLedgerAction,
): string {
  switch (action) {
    case "mint":
      return "Mint";
    case "burn":
      return "Burn";
    case "deposit":
      return "Deposit reserves";
    case "redeem":
      return "Redeem reserves";
  }
}
