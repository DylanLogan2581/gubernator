import { getErrorDescription } from "@/lib/errorUtils";

import { isPartnershipMutationError } from "../mutations/partnershipsMutations";

export function getPartnershipMutationErrorDescription(error: unknown): string {
  if (isPartnershipMutationError(error)) {
    const firstIssue = error.issues[0];
    if (firstIssue !== undefined) {
      return firstIssue.message;
    }
    return error.message;
  }
  return getErrorDescription(error);
}

export function getAdminUnavailableReason({
  currentTurnQuery,
  isArchived,
  latestTransitionQuery,
}: {
  readonly currentTurnQuery: {
    readonly isError: boolean;
    readonly data: unknown;
  };
  readonly isArchived: boolean;
  readonly latestTransitionQuery: {
    readonly isError: boolean;
    readonly data: unknown;
  };
}): string | null {
  if (isArchived) {
    return "Partnership controls are disabled because this world is archived.";
  }
  if (latestTransitionQuery.isError) {
    return "Could not load the latest turn transition; partnership controls are disabled.";
  }
  if (currentTurnQuery.isError) {
    return "Could not load the current turn; partnership controls are disabled.";
  }
  if (
    latestTransitionQuery.data === null ||
    latestTransitionQuery.data === undefined
  ) {
    return "Partnership controls require at least one recorded turn transition for this world.";
  }
  return null;
}
