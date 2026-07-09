import type { CitizenType } from "@/features/citizens";

export type OfficeTypeScope = "nation" | "settlement";

// #1114: the office_types registry row. nationId null = world-default
// (owned/managed by world admins, available to every nation); nationId set
// = a custom office a nation manager invented for that nation only.
export type OfficeType = {
  readonly color: string | null;
  readonly description: string | null;
  readonly excludesFromLabor: boolean;
  readonly icon: string | null;
  readonly id: string;
  readonly maxHolders: number | null;
  readonly name: string;
  readonly nationId: string | null;
  readonly scope: OfficeTypeScope;
  readonly worldId: string;
};

export type NationOfficeRosterEntry = {
  readonly appointedTurnNumber: number;
  readonly citizenId: string;
  readonly citizenName: string;
  readonly citizenType: CitizenType;
  readonly id: string;
  readonly nationId: string;
  readonly officeTypeId: string;
  readonly officeTypeName: string;
  readonly worldId: string;
};

// #1115: settlement-scoped counterpart of NationOfficeRosterEntry -- same
// shape, keyed by settlementId instead of nationId.
export type SettlementOfficeRosterEntry = {
  readonly appointedTurnNumber: number;
  readonly citizenId: string;
  readonly citizenName: string;
  readonly citizenType: CitizenType;
  readonly id: string;
  readonly officeTypeId: string;
  readonly officeTypeName: string;
  readonly settlementId: string;
  readonly worldId: string;
};

const KNOWN_OFFICE_TYPE_LABELS: Readonly<Record<string, string>> = {
  senator: "Senator",
  elder: "Elder",
  clergy: "Clergy",
  chancellor: "Chancellor",
  treasurer: "Treasurer",
  bank_governor: "Bank Governor",
  delegate: "Delegate",
};

// The seven Epic 11 (#1079) default office type names get a curated label;
// custom office type names (#1114, e.g. "Lord Commander of the Night Watch")
// are free text a nation manager chose and are shown verbatim.
export function formatNationOfficeType(name: string): string {
  return KNOWN_OFFICE_TYPE_LABELS[name] ?? name;
}
