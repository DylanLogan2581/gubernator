import { useActivePlayerCharacter } from "../context/activePlayerCharacterContext";
import { checkCanManageNation } from "../utils/manageAuthority";

type UseNationManageAuthorityInput = {
  readonly nationId: string;
  readonly canAdmin: boolean;
};

type NationManageAuthority = {
  readonly canManageNation: boolean;
};

export function useNationManageAuthority({
  canAdmin,
  nationId,
}: UseNationManageAuthorityInput): NationManageAuthority {
  const { activeCharacter } = useActivePlayerCharacter();

  return {
    canManageNation: checkCanManageNation({
      activeCharacter,
      canAdmin,
      nationId,
    }),
  };
}
