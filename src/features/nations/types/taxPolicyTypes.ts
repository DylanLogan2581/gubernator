import type { Database } from "@/types/database";

export type TaxMethod = Database["public"]["Enums"]["tax_method"];

export const TAX_METHODS: readonly TaxMethod[] = [
  "percent_production",
  "percent_stockpile",
  "flat",
];

export function formatTaxMethod(method: TaxMethod): string {
  switch (method) {
    case "percent_production":
      return "Percent of production";
    case "percent_stockpile":
      return "Percent of stockpile";
    case "flat":
      return "Flat amount per resource";
  }
}

// A single tax rule. `settlementId === null` is the nation-wide DEFAULT rule;
// a non-null settlementId is a per-settlement override. `taxedResourceIds ===
// null` means "all resources"; otherwise only the listed resource ids.
export type NationTaxPolicy = {
  readonly exempt: boolean;
  readonly flatAmount: number;
  readonly id: string;
  readonly method: TaxMethod;
  readonly minStockpileFloor: number;
  readonly nationId: string;
  readonly rate: number;
  readonly settlementId: string | null;
  readonly taxedResourceIds: readonly string[] | null;
};
