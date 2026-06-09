export type PartnershipStatus = "active" | "dissolved" | "widowed";

export type Partnership = {
  readonly changeReason: string | null;
  readonly changedByUserId: string | null;
  readonly citizenAId: string;
  readonly citizenBId: string;
  readonly createdAt: string;
  readonly endedOnTurnNumber: number | null;
  readonly formedOnTurnNumber: number;
  readonly id: string;
  readonly status: PartnershipStatus;
  readonly updatedAt: string;
};
