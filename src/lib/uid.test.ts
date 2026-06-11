import { v4 as uuidV4 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

import { generateLocalId } from "./uid";

vi.mock("uuid", async () => {
  const actual = await vi.importActual<{ v4: () => string }>("uuid");
  return { v4: vi.fn(actual.v4) };
});

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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- tsc resolves overloaded v4 to the Uint8Array variant without the cast; the assertion IS load-bearing
    vi.mocked(uuidV4 as () => string).mockReturnValueOnce(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(generateLocalId()).toBe("00000000-0000-0000-0000-000000000000");
  });

  it("still works when crypto.randomUUID is undefined (non-secure context)", () => {
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
