import { describe, expect, it } from "vitest";

import type { BodyCompositionRule } from "@/shared/government";

import {
  fromDbComposition,
  toDbComposition,
} from "./governmentBodyCompositionMapper";

const OFFICE_TYPE_ID = "11111111-1111-4111-8111-111111111111";
const CITIZEN_ID_1 = "22222222-2222-4222-8222-222222222222";
const CITIZEN_ID_2 = "33333333-3333-4333-8333-333333333333";

describe("toDbComposition", () => {
  it("maps office_type to snake_case", () => {
    expect(
      toDbComposition([{ kind: "office_type", officeTypeId: OFFICE_TYPE_ID }]),
    ).toEqual([{ kind: "office_type", office_type_id: OFFICE_TYPE_ID }]);
  });

  it("maps citizens to snake_case", () => {
    expect(
      toDbComposition([
        { kind: "citizens", citizenIds: [CITIZEN_ID_1, CITIZEN_ID_2] },
      ]),
    ).toEqual([
      { kind: "citizens", citizen_ids: [CITIZEN_ID_1, CITIZEN_ID_2] },
    ]);
  });

  it("maps ruler as kind-only", () => {
    expect(toDbComposition([{ kind: "ruler" }])).toEqual([{ kind: "ruler" }]);
  });

  it("maps settlement_managers as kind-only", () => {
    expect(toDbComposition([{ kind: "settlement_managers" }])).toEqual([
      { kind: "settlement_managers" },
    ]);
  });

  it("throws on an empty citizen_ids array, mirroring the DB check", () => {
    const rules: readonly BodyCompositionRule[] = [
      { kind: "citizens", citizenIds: [] },
    ];
    expect(() => toDbComposition(rules)).toThrow();
  });
});

describe("fromDbComposition", () => {
  it("maps office_type from snake_case", () => {
    expect(
      fromDbComposition([
        { kind: "office_type", office_type_id: OFFICE_TYPE_ID },
      ]),
    ).toEqual([{ kind: "office_type", officeTypeId: OFFICE_TYPE_ID }]);
  });

  it("maps citizens from snake_case", () => {
    expect(
      fromDbComposition([
        { kind: "citizens", citizen_ids: [CITIZEN_ID_1, CITIZEN_ID_2] },
      ]),
    ).toEqual([{ kind: "citizens", citizenIds: [CITIZEN_ID_1, CITIZEN_ID_2] }]);
  });

  it("maps ruler as kind-only", () => {
    expect(fromDbComposition([{ kind: "ruler" }])).toEqual([{ kind: "ruler" }]);
  });

  it("maps settlement_managers as kind-only", () => {
    expect(fromDbComposition([{ kind: "settlement_managers" }])).toEqual([
      { kind: "settlement_managers" },
    ]);
  });

  it("throws on a malformed composition_json value", () => {
    expect(() => fromDbComposition([{ kind: "unknown" }])).toThrow();
  });
});
