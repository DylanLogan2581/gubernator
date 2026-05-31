import { afterEach, describe, expect, it, vi } from "vitest";

import { generateLocalId } from "./uid";

describe("generateLocalId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a non-empty string", () => {
    const id = generateLocalId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique values on successive calls", () => {
    const a = generateLocalId();
    const b = generateLocalId();
    expect(a).not.toBe(b);
  });

  it("can be mocked in tests", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(generateLocalId()).toBe("00000000-0000-0000-0000-000000000000");
  });
});
