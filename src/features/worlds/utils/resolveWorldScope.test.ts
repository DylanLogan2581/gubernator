import { describe, expect, it } from "vitest";

import { resolveWorldScope } from "./resolveWorldScope";

const EMPTY_PIN = { nationId: null, settlementId: null };

describe("resolveWorldScope", () => {
  it("prefers route params over stored pin and active character", () => {
    expect(
      resolveWorldScope({
        activeCharacterSettlementId: "home-settlement",
        routeNationId: "route-nation",
        routeSettlementId: "route-settlement",
        storedPin: {
          nationId: "stored-nation",
          settlementId: "stored-settlement",
        },
      }),
    ).toEqual({ nationId: "route-nation", settlementId: "route-settlement" });
  });

  it("falls back to the stored pin when route params are absent", () => {
    expect(
      resolveWorldScope({
        activeCharacterSettlementId: "home-settlement",
        routeNationId: null,
        routeSettlementId: null,
        storedPin: {
          nationId: "stored-nation",
          settlementId: "stored-settlement",
        },
      }),
    ).toEqual({ nationId: "stored-nation", settlementId: "stored-settlement" });
  });

  it("falls back to the active character's home settlement as the last resort", () => {
    expect(
      resolveWorldScope({
        activeCharacterSettlementId: "home-settlement",
        routeNationId: null,
        routeSettlementId: null,
        storedPin: EMPTY_PIN,
      }),
    ).toEqual({ nationId: null, settlementId: "home-settlement" });
  });

  it("resolves to null when nothing resolves at any tier", () => {
    expect(
      resolveWorldScope({
        activeCharacterSettlementId: null,
        routeNationId: null,
        routeSettlementId: null,
        storedPin: EMPTY_PIN,
      }),
    ).toEqual({ nationId: null, settlementId: null });
  });

  it("resolves nation and settlement independently", () => {
    expect(
      resolveWorldScope({
        activeCharacterSettlementId: "home-settlement",
        routeNationId: "route-nation",
        routeSettlementId: null,
        storedPin: {
          nationId: "stored-nation",
          settlementId: "stored-settlement",
        },
      }),
    ).toEqual({ nationId: "route-nation", settlementId: "stored-settlement" });
  });

  it("does not derive a nation id from the active character's home settlement", () => {
    expect(
      resolveWorldScope({
        activeCharacterSettlementId: "home-settlement",
        routeNationId: null,
        routeSettlementId: null,
        storedPin: EMPTY_PIN,
      }).nationId,
    ).toBeNull();
  });
});
