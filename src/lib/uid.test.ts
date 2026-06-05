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

  it("falls back to crypto.getRandomValues when crypto.randomUUID is undefined", () => {
    const saved = crypto.randomUUID.bind(crypto);
    delete (crypto as { randomUUID?: typeof crypto.randomUUID }).randomUUID;
    try {
      const id = generateLocalId();
      expect(typeof id).toBe("string");
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      crypto.randomUUID = saved;
    }
  });
});
