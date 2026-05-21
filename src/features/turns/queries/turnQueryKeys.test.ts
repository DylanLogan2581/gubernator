import { describe, expect, it } from "vitest";

import { turnQueryKeys } from "@/features/turns";

describe("turnQueryKeys", () => {
  it("centralizes turn query key roots", () => {
    expect(turnQueryKeys.all).toEqual(["turns"]);
  });

  it("creates stable current turn state keys scoped by world id", () => {
    expect(turnQueryKeys.currentTurnState("world-1")).toEqual([
      "turns",
      "current-turn-state",
      "world-1",
    ]);
    expect(turnQueryKeys.currentTurnState("world-1")).toEqual(
      turnQueryKeys.currentTurnState("world-1"),
    );
    expect(turnQueryKeys.currentTurnState("world-2")).toEqual([
      "turns",
      "current-turn-state",
      "world-2",
    ]);
  });

  it("creates stable latest transition status keys scoped by world id", () => {
    expect(turnQueryKeys.latestTransitionStatus("world-1")).toEqual([
      "turns",
      "latest-transition-status",
      "world-1",
    ]);
    expect(turnQueryKeys.latestTransitionStatus("world-1")).toEqual(
      turnQueryKeys.latestTransitionStatus("world-1"),
    );
    expect(turnQueryKeys.latestTransitionStatus("world-2")).toEqual([
      "turns",
      "latest-transition-status",
      "world-2",
    ]);
  });
});
