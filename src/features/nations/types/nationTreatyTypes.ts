export type NationTreatyType =
  | "tribute"
  | "trade_agreement"
  | "royal_marriage"
  | "currency_exchange";

export type NationTreatyStatus =
  | "proposed"
  | "active"
  | "declined"
  | "withdrawn"
  | "expired"
  | "broken";

export type TributeTreatyTerms = {
  readonly payer: "proposer" | "responder";
  readonly quantityPerTurn: number;
  readonly resourceId: string;
};

export type TradeAgreementTreatyTerms = Record<string, never>;

export type RoyalMarriageTreatyTerms = {
  readonly citizenAId: string;
  readonly citizenBId: string;
};

export type CurrencyExchangeTreatyTerms = Record<string, unknown>;

export type NationTreatyTerms =
  | TributeTreatyTerms
  | TradeAgreementTreatyTerms
  | RoyalMarriageTreatyTerms
  | CurrencyExchangeTreatyTerms;

export type NationTreaty = {
  readonly createdAt: string;
  readonly durationTurns: number | null;
  readonly endsTurnNumber: number | null;
  readonly id: string;
  readonly proposedByCitizenId: string | null;
  readonly proposerNationId: string;
  readonly respondedByCitizenId: string | null;
  readonly responderNationId: string;
  readonly startsTurnNumber: number | null;
  readonly status: NationTreatyStatus;
  readonly terms: NationTreatyTerms;
  readonly treatyType: NationTreatyType;
  readonly updatedAt: string;
  readonly worldId: string;
};

export function formatNationTreatyType(type: NationTreatyType): string {
  switch (type) {
    case "tribute":
      return "Tribute";
    case "trade_agreement":
      return "Trade agreement";
    case "royal_marriage":
      return "Royal marriage";
    case "currency_exchange":
      return "Currency exchange";
    default:
      return type;
  }
}

export function formatNationTreatyStatus(status: NationTreatyStatus): string {
  switch (status) {
    case "proposed":
      return "Proposed";
    case "active":
      return "Active";
    case "declined":
      return "Declined";
    case "withdrawn":
      return "Withdrawn";
    case "expired":
      return "Expired";
    case "broken":
      return "Broken";
    default:
      return status;
  }
}
