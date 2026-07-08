import {
  Coins,
  Crown,
  Handshake,
  Landmark,
  type LucideIcon,
} from "lucide-react";

import type {
  NationTreaty,
  NationTreatyStatus,
  NationTreatyType,
  RoyalMarriageTreatyTerms,
  TributeTreatyTerms,
} from "../../types/nationTreatyTypes";

export function getTreatyTypeIconConfig(type: NationTreatyType): {
  Icon: LucideIcon;
  label: string;
} {
  switch (type) {
    case "tribute":
      return { Icon: Coins, label: "Tribute" };
    case "trade_agreement":
      return { Icon: Handshake, label: "Trade agreement" };
    case "royal_marriage":
      return { Icon: Crown, label: "Royal marriage" };
    case "currency_exchange":
      return { Icon: Landmark, label: "Currency exchange" };
    default:
      return { Icon: Handshake, label: type };
  }
}

export function getTreatyStatusBadgeClassName(
  status: NationTreatyStatus,
): string {
  switch (status) {
    case "proposed":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300";
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300";
    case "declined":
      return "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300";
    case "withdrawn":
      return "bg-muted text-muted-foreground";
    case "expired":
      return "bg-muted text-muted-foreground";
    case "broken":
      return "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function formatTreatyTerms(
  treaty: NationTreaty,
  {
    citizenNamesById,
    proposerName,
    resourceNamesById,
    responderName,
  }: {
    readonly citizenNamesById: ReadonlyMap<string, string>;
    readonly proposerName: string;
    readonly resourceNamesById: ReadonlyMap<string, string>;
    readonly responderName: string;
  },
): string {
  if (treaty.treatyType === "tribute") {
    const terms = treaty.terms as TributeTreatyTerms;
    const payerName = terms.payer === "proposer" ? proposerName : responderName;
    const resourceName =
      resourceNamesById.get(terms.resourceId) ?? "unknown resource";
    return `${payerName} pays ${String(terms.quantityPerTurn)} ${resourceName} per turn`;
  }

  if (treaty.treatyType === "royal_marriage") {
    const terms = treaty.terms as RoyalMarriageTreatyTerms;
    const citizenAName =
      citizenNamesById.get(terms.citizenAId) ?? "unknown citizen";
    const citizenBName =
      citizenNamesById.get(terms.citizenBId) ?? "unknown citizen";
    return `Royal marriage: ${citizenAName} ↔ ${citizenBName}`;
  }

  if (treaty.treatyType === "trade_agreement") {
    return `Trade agreement between ${proposerName} and ${responderName}`;
  }

  return "Currency exchange";
}

export function formatTreatyExpiry(
  endsTurnNumber: number | null,
  formatTurn: (turnNumber: number) => string,
): string {
  return endsTurnNumber === null ? "Indefinite" : formatTurn(endsTurnNumber);
}
