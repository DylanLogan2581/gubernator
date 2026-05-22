export type NationUnilateralStance =
  | "neutral"
  | "friendly"
  | "hostile"
  | "at_war";

export type NationBilateralStance = "allied" | "non_aggression_pact";

export type NationRelationshipStance =
  | NationUnilateralStance
  | NationBilateralStance;

export type NationRelationshipPendingStatus =
  | "proposed"
  | "accepted"
  | "declined"
  | "withdrawn";

export type NationRelationship = {
  readonly createdAt: string;
  readonly currentStance: NationRelationshipStance;
  readonly fromNationId: string;
  readonly id: string;
  readonly pendingChangedByCitizenId: string | null;
  readonly pendingStance: NationBilateralStance | null;
  readonly pendingStatus: NationRelationshipPendingStatus | null;
  readonly toNationId: string;
  readonly updatedAt: string;
};

export type NationBilateralResponse = "accepted" | "declined";
