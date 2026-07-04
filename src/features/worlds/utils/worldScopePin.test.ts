import { beforeEach, describe, expect, it, vi } from "vitest";

import { readWorldScopePin, writeWorldScopePin } from "./worldScopePin";

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
