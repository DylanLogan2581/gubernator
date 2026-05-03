import { describe, expect, it } from "vitest";

import {
  createSettlementReadinessResetUpdate,
  createSettlementReadinessResetUpdatePayload,
  createSettlementReadinessResetUpdates,
} from "./settlementReadinessReset";
import { isSettlementReadyForCurrentTurn } from "./settlementReadinessSummary";

describe("createSettlementReadinessResetUpdatePayload", () => {
  it("resets non-auto-ready settlements to not ready and clears ready_set_at", () => {
    const payload = createSettlementReadinessResetUpdatePayload({
      auto_ready_enabled: false,
      id: "settlement-1",
    });

    expect(payload).toEqual({
      is_ready_current_turn: false,
      ready_set_at: null,
    });
    expect(
      isSettlementReadyForCurrentTurn({
        auto_ready_enabled: false,
        is_ready_current_turn: payload.is_ready_current_turn,
      }),
    ).toBe(false);
  });

  it("keeps auto-ready settlements effectively ready without writing a manual ready_set_at", () => {
    const payload = createSettlementReadinessResetUpdatePayload({
      auto_ready_enabled: true,
      id: "settlement-1",
    });

    expect(payload).toEqual({
      is_ready_current_turn: true,
      ready_set_at: null,
    });
    expect(
      isSettlementReadyForCurrentTurn({
        auto_ready_enabled: true,
        is_ready_current_turn: payload.is_ready_current_turn,
      }),
    ).toBe(true);
  });
});

describe("createSettlementReadinessResetUpdate", () => {
  it("maps reset behavior to one settlement update payload", () => {
    expect(
      createSettlementReadinessResetUpdate({
        auto_ready_enabled: false,
        id: "settlement-1",
      }),
    ).toEqual({
      id: "settlement-1",
      payload: {
        is_ready_current_turn: false,
        ready_set_at: null,
      },
    });
  });

  it("maps mixed settlement rows to ordered update payloads", () => {
    expect(
      createSettlementReadinessResetUpdates([
        {
          auto_ready_enabled: true,
          id: "settlement-1",
        },
        {
          auto_ready_enabled: false,
          id: "settlement-2",
        },
      ]),
    ).toEqual([
      {
        id: "settlement-1",
        payload: {
          is_ready_current_turn: true,
          ready_set_at: null,
        },
      },
      {
        id: "settlement-2",
        payload: {
          is_ready_current_turn: false,
          ready_set_at: null,
        },
      },
    ]);
  });
});
