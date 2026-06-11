import { describe, expect, it } from "vitest";

import {
  checkCanManageNation,
  checkCanManageSettlement,
} from "./manageAuthority";

const NATION_ID = "nation-1";
const OTHER_NATION_ID = "nation-2";
const SETTLEMENT_ID = "settlement-1";
const OTHER_SETTLEMENT_ID = "settlement-2";

function makeCharacter(
  overrides: Partial<{
    roleType: string;
    roleNationId: string | null;
    roleSettlementId: string | null;
    status: string;
  }> = {},
): {
  readonly roleType: string;
  readonly roleNationId: string | null;
  readonly roleSettlementId: string | null;
  readonly status: string;
} {
  return {
    roleType: "citizen",
    roleNationId: null,
    roleSettlementId: null,
    status: "alive",
    ...overrides,
  };
}

describe("checkCanManageNation", () => {
  it("returns true for super admin / world admin (canAdmin=true)", () => {
    expect(
      checkCanManageNation({
        canAdmin: true,
        nationId: NATION_ID,
        activeCharacter: null,
      }),
    ).toBe(true);
  });

  it("returns true for a nation manager of the target nation", () => {
    expect(
      checkCanManageNation({
        canAdmin: false,
        nationId: NATION_ID,
        activeCharacter: makeCharacter({
          roleType: "nation_manager",
          roleNationId: NATION_ID,
          status: "alive",
        }),
      }),
    ).toBe(true);
  });

  it("returns false for a nation manager of a different nation", () => {
    expect(
      checkCanManageNation({
        canAdmin: false,
        nationId: NATION_ID,
        activeCharacter: makeCharacter({
          roleType: "nation_manager",
          roleNationId: OTHER_NATION_ID,
          status: "alive",
        }),
      }),
    ).toBe(false);
  });

  it("returns false when the nation manager character is not alive", () => {
    expect(
      checkCanManageNation({
        canAdmin: false,
        nationId: NATION_ID,
        activeCharacter: makeCharacter({
          roleType: "nation_manager",
          roleNationId: NATION_ID,
          status: "deceased",
        }),
      }),
    ).toBe(false);
  });

  it("returns false when there is no active character", () => {
    expect(
      checkCanManageNation({
        canAdmin: false,
        nationId: NATION_ID,
        activeCharacter: null,
      }),
    ).toBe(false);
  });
});

describe("checkCanManageSettlement", () => {
  it("returns true for super admin / world admin (canAdmin=true)", () => {
    expect(
      checkCanManageSettlement({
        canAdmin: true,
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        activeCharacter: null,
      }),
    ).toBe(true);
  });

  it("returns true for a nation manager of the parent nation", () => {
    expect(
      checkCanManageSettlement({
        canAdmin: false,
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        activeCharacter: makeCharacter({
          roleType: "nation_manager",
          roleNationId: NATION_ID,
          status: "alive",
        }),
      }),
    ).toBe(true);
  });

  it("returns false for a nation manager of a different nation", () => {
    expect(
      checkCanManageSettlement({
        canAdmin: false,
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        activeCharacter: makeCharacter({
          roleType: "nation_manager",
          roleNationId: OTHER_NATION_ID,
          status: "alive",
        }),
      }),
    ).toBe(false);
  });

  it("returns true for a settlement manager of this settlement", () => {
    expect(
      checkCanManageSettlement({
        canAdmin: false,
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        activeCharacter: makeCharacter({
          roleType: "settlement_manager",
          roleSettlementId: SETTLEMENT_ID,
          status: "alive",
        }),
      }),
    ).toBe(true);
  });

  it("returns false for a settlement manager of a different settlement", () => {
    expect(
      checkCanManageSettlement({
        canAdmin: false,
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        activeCharacter: makeCharacter({
          roleType: "settlement_manager",
          roleSettlementId: OTHER_SETTLEMENT_ID,
          status: "alive",
        }),
      }),
    ).toBe(false);
  });

  it("returns false when the character is not alive", () => {
    expect(
      checkCanManageSettlement({
        canAdmin: false,
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        activeCharacter: makeCharacter({
          roleType: "settlement_manager",
          roleSettlementId: SETTLEMENT_ID,
          status: "deceased",
        }),
      }),
    ).toBe(false);
  });

  it("returns false when there is no active character", () => {
    expect(
      checkCanManageSettlement({
        canAdmin: false,
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        activeCharacter: null,
      }),
    ).toBe(false);
  });
});
