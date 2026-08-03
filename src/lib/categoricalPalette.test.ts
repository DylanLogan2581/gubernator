import { describe, expect, it } from "vitest";

import {
  CATEGORICAL_SLOT_COUNT,
  hashToCategoricalSlot,
} from "@/lib/categoricalPalette";

describe("hashToCategoricalSlot", () => {
  it("returns a slot within the valid range", () => {
    const slot = hashToCategoricalSlot("3f2e1a90-4b7c-4e2a-9c3d-2b1a0f9e8d7c");

    expect(slot).toBeGreaterThanOrEqual(1);
    expect(slot).toBeLessThanOrEqual(CATEGORICAL_SLOT_COUNT);
  });

  it("is deterministic for the same seed", () => {
    const seed = "job-9f8e7d6c-5b4a-3c2d-1e0f-a9b8c7d6e5f4";

    expect(hashToCategoricalSlot(seed)).toBe(hashToCategoricalSlot(seed));
  });

  it("spreads UUID-like keys across most of the palette rather than a few adjacent slots", () => {
    const uuids = [
      "3f2e1a90-4b7c-4e2a-9c3d-2b1a0f9e8d7c",
      "9c3d2b1a-0f9e-8d7c-6f5e-4d3c2b1a0f9e",
      "8d7c6f5e-4d3c-2b1a-0f9e-3f2e1a904b7c",
      "1a0f9e8d-7c6f-5e4d-3c2b-1a0f9e8d7c6f",
      "4b7c4e2a-9c3d-2b1a-0f9e-8d7c9c3d2b1a",
      "6f5e4d3c-2b1a-0f9e-8d7c-3f2e1a904b7c",
      "e5f4a3b2-c1d0-9e8f-7a6b-5c4d3e2f1a0b",
      "0b1a2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
      "d4c5b6a7-8f9e-0d1c-2b3a-4f5e6d7c8b9a",
      "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
      "2c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f",
      "5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
    ];

    const distinctSlots = new Set(uuids.map((id) => hashToCategoricalSlot(id)));

    expect(distinctSlots.size).toBeGreaterThanOrEqual(5);
  });
});
