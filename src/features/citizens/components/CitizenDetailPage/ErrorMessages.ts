import { getErrorDescription } from "@/lib/errorUtils";

import { isCitizenMutationError } from "../../mutations/citizensMutations";
import { isPlayerCharacterRoleMutationError } from "../../mutations/playerCharacterRoleMutations";

export function getCitizenMutationErrorDescription(error: unknown): string {
  if (isCitizenMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
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
