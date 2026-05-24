import { AuthUiError } from "@/features/auth";

import {
  isCitizenMutationError,
  type CitizenMutationError,
} from "../../mutations/citizensMutations";

export type CitizenCreationCommonFields = {
  readonly name: string;
  readonly sex: string;
  readonly parentACitizenId: string;
  readonly parentBCitizenId: string;
};

export const EMPTY_COMMON_FIELDS: CitizenCreationCommonFields = {
  name: "",
  sex: "",
  parentACitizenId: "",
  parentBCitizenId: "",
};

export function getCreationErrorDescription(
  error: AuthUiError | CitizenMutationError | null,
): string {
  if (error === null) {
    return "";
  }
  if (isCitizenMutationError(error) && error.issues.length > 0) {
    return error.issues[0]?.message ?? error.message;
  }
  if (isCitizenMutationError(error)) {
    return error.message;
  }
  if (error instanceof AuthUiError) {
    return error.message;
  }
  return "An unexpected error occurred. Try again.";
}

export function normalizeOptionalUuid(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function validateParentPairing(
  parentACitizenId: string,
  parentBCitizenId: string,
): string | undefined {
  if (
    parentACitizenId !== "" &&
    parentBCitizenId !== "" &&
    parentACitizenId === parentBCitizenId
  ) {
    return "A citizen cannot be both parents.";
  }
  return undefined;
}
