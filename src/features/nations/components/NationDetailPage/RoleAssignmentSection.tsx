import { Card } from "@/components/ui/card";
import {
  checkCanManageNation,
  RoleAssignmentControls,
  useActivePlayerCharacter,
} from "@/features/permissions";

import type { Nation } from "../../types/nationTypes";
import type { JSX } from "react";

export function NationRoleAssignmentSection({
  canAdminWorld,
  isArchived,
  nation,
}: {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
}): JSX.Element | null {
  const { activeCharacter } = useActivePlayerCharacter();
  // canAdmin is deliberately false: this section needs the raw
  // nation-manager check separate from world-admin access, since both are
  // passed to RoleAssignmentControls individually.
  const isNationManager = checkCanManageNation({
    activeCharacter,
    canAdmin: false,
    nationId: nation.id,
  });

  if (!canAdminWorld && !isNationManager) {
    return null;
  }

  return (
    <Card
      aria-labelledby="nation-role-assignment-heading"
      className="grid gap-3 p-4"
    >
      <div className="space-y-1">
        <h2
          id="nation-role-assignment-heading"
          className="text-base font-medium"
        >
          Settlement Manager assignments
        </h2>
        <p className="text-sm text-muted-foreground">
          {canAdminWorld
            ? "Assign or revoke the Settlement Manager role for citizens (player characters or alive NPCs) in this nation."
            : "Assign or revoke the Settlement Manager role for citizens (player characters or alive NPCs) in your nation."}
        </p>
      </div>
      <RoleAssignmentControls
        canAdminWorld={canAdminWorld}
        isArchived={isArchived}
        isNationManager={isNationManager}
        nation={nation}
        variant="nation"
      />
    </Card>
  );
}
