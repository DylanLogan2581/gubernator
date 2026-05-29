import { getErrorDescription } from "@/lib/errorUtils";

import { isSettlementMutationError } from "../../mutations/settlementsMutations";

export function getMutationErrorDescription(error: unknown): string {
  if (isSettlementMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
}
