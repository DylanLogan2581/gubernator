import { describe, expect, it } from "vitest";

import { isEventRow } from "./rowTypes";

describe("isEventRow", () => {
  const base = {
    id: "e9fd872b-c5b9-451b-bc23-4ac8c7e7d942",
    status: "pending",
    effect_type: "deposit_discovered",
    activate_on_transition_after_turn_number: 2,
    duration_type: "sustained",
    remaining_transitions: 2,
    effect_payload_jsonb: {},
  };

  it("accepts a legacy event row with a string effect_type", () => {
    expect(isEventRow(base)).toBe(true);
  });

  it("accepts a structured/memory-only event row with a null effect_type", () => {
    // effect_type became nullable (20260708); such events must still simulate
    // so they activate and fan out citizen memories.
    expect(isEventRow({ ...base, effect_type: null })).toBe(true);
  });

  it("rejects a row missing the id", () => {
    const { id: _id, ...withoutId } = base;
    expect(isEventRow(withoutId)).toBe(false);
  });

  it("rejects a row with a numeric effect_type", () => {
    expect(isEventRow({ ...base, effect_type: 7 })).toBe(false);
  });
});
