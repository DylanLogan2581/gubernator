import { type JSX } from "react";

import type { Citizen } from "@/features/citizens";
import type { Nation } from "@/features/nations";

import { CitizenRoleAssignmentControls } from "./CitizenRoleAssignment";
import { NationRoleAssignmentControls } from "./NationRoleAssignment";

export type RoleSelection = "none" | "nation_manager" | "settlement_manager";

type CitizenVariantProps = {
  readonly canAdminWorld: boolean;
  readonly citizen: Citizen;
  readonly isArchived: boolean;
  readonly variant: "citizen";
};

type NationVariantProps = {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly isNationManager: boolean;
  readonly nation: Nation;
  readonly variant: "nation";
};

export type RoleAssignmentControlsProps =
  | CitizenVariantProps
  | NationVariantProps;

// Shared role-assignment surface for the two places it appears in the app:
// the citizen detail screen (World Admin path) and the nation detail screen
// (Nation Manager path, restricted to Settlement Manager only).
// Direct writes to role columns are blocked by column-level grants, so all
// changes route through the assign_citizen_role / revoke_citizen_role RPCs.
export function RoleAssignmentControls(
  props: RoleAssignmentControlsProps,
): JSX.Element | null {
  if (props.variant === "citizen") {
    return <CitizenRoleAssignmentControls {...props} />;
  }
  return <NationRoleAssignmentControls {...props} />;
}
