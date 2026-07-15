import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  nextWorldScopePin,
  readWorldScopePin,
  writeWorldScopePin,
} from "./worldScopePin";

const WORLD_ID = "world-1";

describe("worldScopePin", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to an empty pin when nothing is stored", () => {
    expect(readWorldScopePin(WORLD_ID)).toEqual({
      nationId: null,
      settlementId: null,
    });
  });

  it("round-trips a pin through localStorage", () => {
    writeWorldScopePin(WORLD_ID, {
      nationId: "nation-1",
      settlementId: "settlement-1",
    });
    expect(readWorldScopePin(WORLD_ID)).toEqual({
      nationId: "nation-1",
      settlementId: "settlement-1",
    });
  });

  it("scopes the pin per world", () => {
    writeWorldScopePin(WORLD_ID, {
      nationId: "nation-1",
      settlementId: "settlement-1",
    });
    expect(readWorldScopePin("other-world")).toEqual({
      nationId: null,
      settlementId: null,
    });
  });

  it("degrades to an empty pin on corrupt storage", () => {
    window.localStorage.setItem(
      `gubernator:world-scope-pin:${WORLD_ID}`,
      "not json",
    );
    expect(readWorldScopePin(WORLD_ID)).toEqual({
      nationId: null,
      settlementId: null,
    });
  });

  it("swallows storage errors and returns an empty pin", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });

    expect(readWorldScopePin(WORLD_ID)).toEqual({
      nationId: null,
      settlementId: null,
    });

    getItem.mockRestore();
  });
});

describe("nextWorldScopePin", () => {
  const storedPin = { nationId: "nation-a", settlementId: "settlement-a" };

  it("returns the stored pin unchanged when the route has no scope params", () => {
    expect(
      nextWorldScopePin({
        routeNationId: null,
        routeSettlementId: null,
        storedPin,
      }),
    ).toEqual(storedPin);
  });

  it("clears the settlement when the route switches to a different nation", () => {
    expect(
      nextWorldScopePin({
        routeNationId: "nation-b",
        routeSettlementId: null,
        storedPin,
      }),
    ).toEqual({ nationId: "nation-b", settlementId: null });
  });

  it("keeps the settlement when the route re-affirms the same nation", () => {
    expect(
      nextWorldScopePin({
        routeNationId: "nation-a",
        routeSettlementId: null,
        storedPin,
      }),
    ).toEqual(storedPin);
  });

  it("prefers an explicit route settlementId even across a nation change", () => {
    expect(
      nextWorldScopePin({
        routeNationId: "nation-b",
        routeSettlementId: "settlement-b",
        storedPin,
      }),
    ).toEqual({ nationId: "nation-b", settlementId: "settlement-b" });
  });

  it("carries the settlement forward when only settlementId changes on the route", () => {
    expect(
      nextWorldScopePin({
        routeNationId: null,
        routeSettlementId: "settlement-c",
        storedPin,
      }),
    ).toEqual({ nationId: "nation-a", settlementId: "settlement-c" });
  });
});
