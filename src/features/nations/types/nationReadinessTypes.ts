import type { NationGovernmentType } from "./nationTypes";

export type NationReadinessMode =
  | "office_majority"
  | "office_unanimous"
  | "ruler_only"
  | "settlement_managers_unanimous";

export type NationReadinessListItem = {
  readonly eligibleVoterCount: number;
  readonly governmentType: NationGovernmentType;
  readonly hasSettlements: boolean;
  readonly isReady: boolean;
  readonly nationId: string;
  readonly nationName: string;
  readonly readinessMode: NationReadinessMode;
  readonly trueVoteCount: number;
};
