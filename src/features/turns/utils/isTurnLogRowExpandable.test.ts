import { describe, expect, it } from "vitest";

import { isTurnLogRowExpandable } from "./isTurnLogRowExpandable";

const UNKNOWN_CATEGORY = "unknown.event";
const NON_EMPTY_PAYLOAD = { value: 42 };
const EMPTY_PAYLOAD = {};

describe("isTurnLogRowExpandable", () => {
  it("is expandable for a well-formed building.auto_deconstructed payload", () => {
    expect(
      isTurnLogRowExpandable(
        "building.auto_deconstructed",
        {
          blueprintId: "bp-1",
          buildingId: "b-1",
          gracePeriodTurns: 3,
          missedUpkeepCount: 4,
        },
        false,
      ),
    ).toBe(true);
  });

  it("is not expandable for a malformed building payload", () => {
    expect(
      isTurnLogRowExpandable(
        "building.auto_deconstructed",
        { bogus: true },
        true,
      ),
    ).toBe(false);
  });

  it("is not expandable for categories with no extra detail", () => {
    expect(
      isTurnLogRowExpandable("construction.completed", { workers: 2 }, true),
    ).toBe(false);
    expect(
      isTurnLogRowExpandable(
        "partnership.formed",
        { citizenAId: "a", citizenBId: "b" },
        true,
      ),
    ).toBe(false);
  });

  it("is only expandable for unknown categories when the viewer is an admin with a non-empty payload", () => {
    expect(
      isTurnLogRowExpandable(UNKNOWN_CATEGORY, NON_EMPTY_PAYLOAD, true),
    ).toBe(true);
    expect(
      isTurnLogRowExpandable(UNKNOWN_CATEGORY, NON_EMPTY_PAYLOAD, false),
    ).toBe(false);
    expect(isTurnLogRowExpandable(UNKNOWN_CATEGORY, EMPTY_PAYLOAD, true)).toBe(
      false,
    );
    expect(isTurnLogRowExpandable(UNKNOWN_CATEGORY, null, true)).toBe(false);
  });
});
