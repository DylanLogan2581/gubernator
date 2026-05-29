import { getErrorDescription } from "@/lib/errorUtils";

import { isNationRelationshipMutationError } from "../../mutations/nationRelationshipMutations";
import { isNationMutationError } from "../../mutations/nationsMutations";

export function getMutationErrorDescription(error: unknown): string {
  if (isNationMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
}

export function getRelationshipMutationErrorDescription(
  error: unknown,
): string {
  if (isNationRelationshipMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
}
