import { describe, expect, it } from "vitest";

import { entityRoute } from "./entityRoutes";

const worldId = "world-1";

describe("entityRoute", () => {
  it("builds the citizen path", () => {
    expect(entityRoute(worldId, { kind: "citizen", citizenId: "c-1" })).toBe(
      "/worlds/world-1/citizens/c-1",
    );
  });

  it("builds the nation path", () => {
    expect(entityRoute(worldId, { kind: "nation", nationId: "n-1" })).toBe(
      "/worlds/world-1/nations/n-1",
    );
  });

  it("builds the settlement path when the nation is known", () => {
    expect(
      entityRoute(worldId, {
        kind: "settlement",
        nationId: "n-1",
        settlementId: "s-1",
      }),
    ).toBe("/worlds/world-1/nations/n-1/settlements/s-1");
  });

  it("returns null for a settlement whose nation is unknown", () => {
    expect(
      entityRoute(worldId, {
        kind: "settlement",
        nationId: null,
        settlementId: "s-1",
      }),
    ).toBeNull();
  });

  it("builds the event path", () => {
    expect(entityRoute(worldId, { kind: "event", eventId: "e-1" })).toBe(
      "/worlds/world-1/events/e-1",
    );
  });

  it("builds the trade-route path", () => {
    expect(
      entityRoute(worldId, {
        kind: "tradeRoute",
        nationId: "n-1",
        settlementId: "s-1",
      }),
    ).toBe("/worlds/world-1/nations/n-1/settlements/s-1/trade");
  });
});
