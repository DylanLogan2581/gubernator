import { type JSX } from "react";

import { useNationManageAuthority } from "@/features/permissions";

import { OfficesSection } from "../offices/OfficesSectionCore";

import type { Nation } from "../../types/nationTypes";

export function NationOfficesSection({
  canAdminWorld,
  isArchived,
  nation,
}: {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
}): JSX.Element {
  const { canManageNation } = useNationManageAuthority({
    canAdmin: canAdminWorld,
    nationId: nation.id,
  });

  return (
    <OfficesSection
      canManage={canManageNation}
      governmentType={nation.governmentType}
      isArchived={isArchived}
      nationId={nation.id}
      nationName={nation.name}
      scope="nation"
      worldId={nation.worldId}
    />
  );
}
