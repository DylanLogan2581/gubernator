import { useActivePlayerCharacter } from "../context/activePlayerCharacterContext";
import {
  checkCanManageNation,
  checkCanManageSettlement,
} from "../utils/manageAuthority";

type UseSettlementManageAuthorityInput = {
  readonly settlementId: string;
  readonly nationId: string;
  readonly canAdmin: boolean;
};

type SettlementManageAuthority = {
  readonly canManageSettlement: boolean;
  readonly canManageNation: boolean;
};

export function useSettlementManageAuthority({
  canAdmin,
  nationId,
  settlementId,
}: UseSettlementManageAuthorityInput): SettlementManageAuthority {
  const { activeCharacter } = useActivePlayerCharacter();

  return {
    canManageNation: checkCanManageNation({
      activeCharacter,
      canAdmin,
      nationId,
    }),
    canManageSettlement: checkCanManageSettlement({
      activeCharacter,
      canAdmin,
      nationId,
      settlementId,
    }),
  };
}
