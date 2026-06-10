
import { isPlayerCharacterRoleMutationError } from "@/features/citizens";
import type { Citizen } from "@/features/citizens";
import { getErrorDescription } from "@/lib/errorUtils";

import { permissionQueryKeys } from "../../queries/permissionQueryKeys";

import type { QueryClient } from "@tanstack/react-query";

export function invalidatePermissionsContext(queryClient: QueryClient): void {
  // The active-player-character context derives the active Citizen from
  // permissions-namespaced queries. Citizens invalidation alone won't refresh
  // it, so we also invalidate the permissions namespace.
  void queryClient.invalidateQueries({ queryKey: permissionQueryKeys.all });
}

export function citizenRoleLabel(
  citizen: Citizen,
  nationName: string | null,
  settlementName: string | null,
): string {
  switch (citizen.roleType) {
    case "none":
      return "None";
    case "nation_manager":
      return `Nation manager${nationName === null ? "" : ` — ${nationName}`}`;
    case "settlement_manager":
      return `Settlement manager${
        settlementName === null ? "" : ` — ${settlementName}`
      }`;
  }
}

export function getRoleMutationErrorDescription(error: unknown): string {
  if (isPlayerCharacterRoleMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
}
