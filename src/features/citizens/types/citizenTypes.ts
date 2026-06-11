export type CitizenType = "npc" | "player_character";
export type CitizenStatus = "alive" | "dead";
export type CitizenRoleType = "none" | "nation_manager" | "settlement_manager";
export type DeathCauseCategory =
  | "starvation"
  | "homeless"
  | "event"
  | "manual_admin"
  | "unknown";
export type CitizenAssignmentType =
  | "standard_job"
  | "construction_project"
  | "deposit"
  | "husbandry"
  | "culling"
  | "trade_route";

export type Citizen = {
  readonly bornOnTurnNumber: number | null;
  readonly citizenType: CitizenType;
  readonly createdAt: string;
  readonly deathCause: string | null;
  readonly deathCauseCategory: DeathCauseCategory | null;
  readonly givenName: string;
  readonly id: string;
  readonly name: string;
  readonly namesetId: string | null;
  readonly parentACitizenId: string | null;
  readonly parentBCitizenId: string | null;
  readonly profilePhotoUrl: string | null;
  readonly roleNationId: string | null;
  readonly roleSettlementId: string | null;
  readonly roleType: CitizenRoleType;
  readonly settlementId: string | null;
  readonly sex: string | null;
  readonly status: CitizenStatus;
  readonly surname: string | null;
  readonly updatedAt: string;
  readonly userId: string | null;
  readonly worldId: string;
};

export type CitizenAdminDetails = {
  readonly npcFlaw: string | null;
  readonly npcGoal: string | null;
  readonly npcSecretContradiction: string | null;
  readonly npcTrait1: string | null;
  readonly npcTrait2: string | null;
  readonly personalityText: string | null;
  readonly skillsText: string | null;
};

export type CitizenTypeBreakdown = Readonly<Record<CitizenType, number>>;
export type CitizenStatusBreakdown = Readonly<Record<CitizenStatus, number>>;
export type CitizenAssignmentTypeBreakdown = Readonly<
  Record<CitizenAssignmentType | "unassigned", number>
>;

export type CitizenAggregateStats = {
  readonly assignmentTypeBreakdown: CitizenAssignmentTypeBreakdown;
  readonly statusBreakdown: CitizenStatusBreakdown;
  readonly total: number;
  readonly typeBreakdown: CitizenTypeBreakdown;
  readonly unassignedNpcCount: number;
  readonly unassignedPcCount: number;
};
