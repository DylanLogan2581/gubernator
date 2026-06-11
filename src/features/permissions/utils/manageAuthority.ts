type ActiveCharacterLike = {
  readonly roleType: string;
  readonly roleNationId: string | null;
  readonly roleSettlementId: string | null;
  readonly status: string;
};

export type NationManageInput = {
  readonly nationId: string;
  readonly canAdmin: boolean;
  readonly activeCharacter: ActiveCharacterLike | null;
};

export type SettlementManageInput = {
  readonly settlementId: string;
  readonly nationId: string;
  readonly canAdmin: boolean;
  readonly activeCharacter: ActiveCharacterLike | null;
};

export function checkCanManageNation({
  canAdmin,
  nationId,
  activeCharacter,
}: NationManageInput): boolean {
  if (canAdmin) return true;
  return (
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nationId &&
    activeCharacter.status === "alive"
  );
}

export function checkCanManageSettlement({
  canAdmin,
  nationId,
  settlementId,
  activeCharacter,
}: SettlementManageInput): boolean {
  if (canAdmin) return true;
  if (activeCharacter === null || activeCharacter.status !== "alive")
    return false;
  if (
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nationId
  )
    return true;
  return (
    activeCharacter.roleType === "settlement_manager" &&
    activeCharacter.roleSettlementId === settlementId
  );
}
