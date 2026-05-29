import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  notifyMutationError,
  notifyMutationSuccess,
  resolveMutationErrorMessage,
} from "./notify";

const { successMock, errorMock } = vi.hoisted(() => ({
  successMock: vi.fn<(message: string) => void>(),
  errorMock: vi.fn<(message: string) => void>(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: successMock,
    error: errorMock,
  },
}));

beforeEach(() => {
  successMock.mockReset();
  errorMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("notifyMutationSuccess", () => {
  it("forwards the message to toast.success", () => {
    notifyMutationSuccess("Saved!");
    expect(successMock).toHaveBeenCalledExactlyOnceWith("Saved!", undefined);
  });

  it("forwards a description option to toast.success", () => {
    notifyMutationSuccess("Saved!", { description: "All changes synced." });
    expect(successMock).toHaveBeenCalledExactlyOnceWith("Saved!", {
      description: "All changes synced.",
    });
  });
});

describe("notifyMutationError", () => {
  it("uses the Error message when present", () => {
    notifyMutationError(new Error("Boom"));
    expect(errorMock).toHaveBeenCalledExactlyOnceWith("Boom");
  });

  it("uses the fallback when the error has no message and a fallback is given", () => {
    notifyMutationError(new Error(""), "Could not save settlement");
    expect(errorMock).toHaveBeenCalledExactlyOnceWith(
      "Could not save settlement",
    );
  });

  it("uses the fallback when the error is not an Error and a fallback is given", () => {
    notifyMutationError({ unexpected: true }, "Could not save settlement");
    expect(errorMock).toHaveBeenCalledExactlyOnceWith(
      "Could not save settlement",
    );
  });

  it("falls back to the generic message when no fallback is provided", () => {
    notifyMutationError(undefined);
    expect(errorMock).toHaveBeenCalledExactlyOnceWith(
      "Try refreshing the page. If the problem continues, contact an administrator.",
    );
  });

  it("prefers the error message over the fallback", () => {
    notifyMutationError(new Error("Validation failed"), "Could not save");
    expect(errorMock).toHaveBeenCalledExactlyOnceWith("Validation failed");
  });
});

describe("resolveMutationErrorMessage", () => {
  it("returns the Error message when present", () => {
    expect(resolveMutationErrorMessage(new Error("Boom"))).toBe("Boom");
  });

  it("returns the fallback for non-Error values when provided", () => {
    expect(resolveMutationErrorMessage("string error", "fallback")).toBe(
      "fallback",
    );
    expect(resolveMutationErrorMessage(null, "fallback")).toBe("fallback");
    expect(resolveMutationErrorMessage(undefined, "fallback")).toBe("fallback");
  });

  it("returns the generic message when no usable message exists", () => {
    expect(resolveMutationErrorMessage(null)).toBe(
      "Try refreshing the page. If the problem continues, contact an administrator.",
    );
  });

  it("ignores empty-string fallbacks", () => {
    expect(resolveMutationErrorMessage(new Error(""), "")).toBe(
      "Try refreshing the page. If the problem continues, contact an administrator.",
    );
  });

  it("returns the Error message even when a fallback is provided", () => {
    expect(resolveMutationErrorMessage(new Error("Conflict"), "fallback")).toBe(
      "Conflict",
    );
  });
});
