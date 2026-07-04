import { describe, expect, it } from "vitest";

import { deriveSettlementReadinessState } from "./settlementReadinessState";

describe("deriveSettlementReadinessState", () => {
  describe("truth table", () => {
    it("returns not-ready when autoReadyEnabled=false and isReadyCurrentTurn=false", () => {
      expect(
        deriveSettlementReadinessState({
          autoReadyEnabled: false,
          isReadyCurrentTurn: false,
        }),
      ).toEqual({ isReadyForCurrentTurn: false, kind: "not-ready" });
    });

    it("returns manually-ready when autoReadyEnabled=false and isReadyCurrentTurn=true", () => {
      expect(
        deriveSettlementReadinessState({
          autoReadyEnabled: false,
          isReadyCurrentTurn: true,
        }),
      ).toEqual({ isReadyForCurrentTurn: true, kind: "manually-ready" });
    });

    it("returns auto-ready not yet ready for current turn when autoReadyEnabled=true and isReadyCurrentTurn=false (auto-ready enabled mid-turn)", () => {
      expect(
        deriveSettlementReadinessState({
          autoReadyEnabled: true,
          isReadyCurrentTurn: false,
        }),
      ).toEqual({ isReadyForCurrentTurn: false, kind: "auto-ready" });
    });

    it("returns auto-ready when autoReadyEnabled=true and isReadyCurrentTurn=true", () => {
      expect(
        deriveSettlementReadinessState({
          autoReadyEnabled: true,
          isReadyCurrentTurn: true,
        }),
      ).toEqual({ isReadyForCurrentTurn: true, kind: "auto-ready" });
    });
  });

  describe("isReadyForCurrentTurn", () => {
    it("is false for not-ready", () => {
      expect(
        deriveSettlementReadinessState({
          autoReadyEnabled: false,
          isReadyCurrentTurn: false,
        }).isReadyForCurrentTurn,
      ).toBe(false);
    });

    it("is true for manually-ready", () => {
      expect(
        deriveSettlementReadinessState({
          autoReadyEnabled: false,
          isReadyCurrentTurn: true,
        }).isReadyForCurrentTurn,
      ).toBe(true);
    });

    it("is false for auto-ready with isReadyCurrentTurn=false (mid-turn, not yet applied)", () => {
      expect(
        deriveSettlementReadinessState({
          autoReadyEnabled: true,
          isReadyCurrentTurn: false,
        }).isReadyForCurrentTurn,
      ).toBe(false);
    });

    it("is true for auto-ready with isReadyCurrentTurn=true", () => {
      expect(
        deriveSettlementReadinessState({
          autoReadyEnabled: true,
          isReadyCurrentTurn: true,
        }).isReadyForCurrentTurn,
      ).toBe(true);
    });
  });
});
