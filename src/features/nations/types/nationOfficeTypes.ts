import type { CitizenType } from "@/features/citizens";
import type { NationOfficeType } from "@/shared/government";

export type NationOfficeRosterEntry = {
  readonly appointedTurnNumber: number;
  readonly citizenId: string;
  readonly citizenName: string;
  readonly citizenType: CitizenType;
  readonly id: string;
  readonly nationId: string;
  readonly officeType: NationOfficeType;
  readonly worldId: string;
};

export function formatNationOfficeType(officeType: NationOfficeType): string {
  switch (officeType) {
    case "senator":
      return "Senator";
    case "elder":
      return "Elder";
    case "clergy":
      return "Clergy";
    case "chancellor":
      return "Chancellor";
    case "treasurer":
      return "Treasurer";
    case "bank_governor":
      return "Bank Governor";
    case "delegate":
      return "Delegate";
  }
}
