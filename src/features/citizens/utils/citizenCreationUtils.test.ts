import { describe, expect, it } from "vitest";

import { AuthUiError } from "@/features/auth";

import { CitizenMutationError } from "../mutations/citizensMutations";

import {
  getCreationErrorDescription,
  normalizeOptionalText,
  normalizeOptionalUuid,
  validateParentPairing,
} from "./citizenCreationUtils";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";

describe("validateParentPairing", () => {
  it("returns undefined when both parents are distinct UUIDs", () => {
    expect(validateParentPairing(UUID_A, UUID_B)).toBeUndefined();
  });

  it("returns an error message when both parents are the same UUID", () => {
    expect(validateParentPairing(UUID_A, UUID_A)).toBe(
      "A citizen cannot be both parents.",
    );
  });

  it("returns undefined when parent A is empty", () => {
    expect(validateParentPairing("", UUID_B)).toBeUndefined();
  });

  it("returns undefined when parent B is empty", () => {
    expect(validateParentPairing(UUID_A, "")).toBeUndefined();
  });

  it("returns undefined when both parents are empty", () => {
    expect(validateParentPairing("", "")).toBeUndefined();
  });
});

describe("normalizeOptionalUuid", () => {
  it("passes through a non-empty value unchanged", () => {
    expect(normalizeOptionalUuid(UUID_A)).toBe(UUID_A);
  });

  it("normalizes an empty string to null", () => {
    expect(normalizeOptionalUuid("")).toBeNull();
  });

  it("normalizes a whitespace-only string to null", () => {
    expect(normalizeOptionalUuid("   ")).toBeNull();
  });

  it("trims surrounding whitespace from a non-empty value", () => {
    expect(normalizeOptionalUuid(`  ${UUID_A}  `)).toBe(UUID_A);
  });
});

describe("normalizeOptionalText", () => {
  it("passes through a non-empty value unchanged", () => {
    expect(normalizeOptionalText("some text")).toBe("some text");
  });

  it("normalizes an empty string to null", () => {
    expect(normalizeOptionalText("")).toBeNull();
  });

  it("normalizes a whitespace-only string to null", () => {
    expect(normalizeOptionalText("   ")).toBeNull();
  });

  it("trims surrounding whitespace from a non-empty value", () => {
    expect(normalizeOptionalText("  hello  ")).toBe("hello");
  });
});

describe("getCreationErrorDescription", () => {
  it("returns an empty string when error is null", () => {
    expect(getCreationErrorDescription(null)).toBe("");
  });

  it("returns the first issue message when CitizenMutationError has issues", () => {
    const error = new CitizenMutationError({
      code: "citizen_input_invalid",
      issues: [
        { message: "Name is required.", path: ["name"] },
        { message: "Sex is required.", path: ["sex"] },
      ],
      message: "Citizen input is invalid.",
    });
    expect(getCreationErrorDescription(error)).toBe("Name is required.");
  });

  it("returns the error message when CitizenMutationError has no issues", () => {
    const error = new CitizenMutationError({
      code: "citizen_creation_blocked",
      issues: [],
      message: "Citizen could not be created.",
    });
    expect(getCreationErrorDescription(error)).toBe(
      "Citizen could not be created.",
    );
  });

  it("returns the AuthUiError message for auth errors", () => {
    const error = new AuthUiError({ message: "Session expired." });
    expect(getCreationErrorDescription(error)).toBe("Session expired.");
  });

  it("returns the fallback message for unrecognized error types", () => {
    const error = new Error("Something went wrong") as AuthUiError;
    expect(getCreationErrorDescription(error)).toBe(
      "An unexpected error occurred. Try again.",
    );
  });
});
