import { Card } from "@/components/ui/card";
import {
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
  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nation.id &&
    activeCharacter.status === "alive";

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
            ? "Assign or revoke the Settlement Manager role for player characters in this nation."
            : "Assign or revoke the Settlement Manager role for player characters in your nation."}
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
