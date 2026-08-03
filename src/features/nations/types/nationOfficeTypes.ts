import type { CitizenType } from "@/features/citizens";

export type OfficeTypeScope = "nation" | "settlement";

// #1114: the office_types registry row. nationId null = world-default
// (owned/managed by world admins, available to every nation); nationId set
// = a custom office a nation manager invented for that nation only.
export type OfficeType = {
  readonly color: string | null;
  // #1123: prefills the appoint dialog's term field; the caller may override it.
  readonly defaultTermTurns: number | null;
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
  // #1123: null = indefinite term, never expires.
  readonly expiresTurnNumber: number | null;
  readonly id: string;
  readonly nationId: string;
  readonly officeTypeId: string;
  readonly officeTypeName: string;
  readonly termTurns: number | null;
  readonly worldId: string;
};

// #1115: settlement-scoped counterpart of NationOfficeRosterEntry -- same
// shape, keyed by settlementId instead of nationId.
export type SettlementOfficeRosterEntry = {
  readonly appointedTurnNumber: number;
  readonly citizenId: string;
  readonly citizenName: string;
  readonly citizenType: CitizenType;
  readonly expiresTurnNumber: number | null;
  readonly id: string;
  readonly officeTypeId: string;
  readonly officeTypeName: string;
  readonly settlementId: string;
  readonly termTurns: number | null;
  readonly worldId: string;
};

// #1123: an archived (term-ended) officeholder, kept for roster history.
export type NationOfficeHistoryEntry = NationOfficeRosterEntry & {
  readonly endedTurnNumber: number;
};

export type SettlementOfficeHistoryEntry = SettlementOfficeRosterEntry & {
  readonly endedTurnNumber: number;
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
