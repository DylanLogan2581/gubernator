import { describe, expect, it } from "vitest";

import { setPerTargetAssignmentInputSchema } from "./setPerTargetAssignmentSchemas";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const TARGET_ID = "22222222-2222-2222-2222-222222222222";
const CITIZEN_ID_1 = "33333333-3333-3333-3333-333333333331";
const CITIZEN_ID_2 = "33333333-3333-3333-3333-333333333332";

describe("setPerTargetAssignmentInputSchema", () => {
  describe("deposit variant", () => {
    it("accepts valid deposit input with citizens", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "deposit",
        citizenIds: [CITIZEN_ID_1, CITIZEN_ID_2],
        settlementId: SETTLEMENT_ID,
        targetId: TARGET_ID,
      });

      expect(result.success).toBe(true);
    });

    it("accepts valid deposit input with empty citizen list", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "deposit",
        citizenIds: [],
        settlementId: SETTLEMENT_ID,
        targetId: TARGET_ID,
      });

      expect(result.success).toBe(true);
    });

    it("rejects extra fields (strict mode)", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "deposit",
        citizenIds: [CITIZEN_ID_1],
        settlementId: SETTLEMENT_ID,
        targetId: TARGET_ID,
        tradeRouteEnd: "origin",
      });

      expect(result.success).toBe(false);
    });

    it("rejects a non-UUID citizenId", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "deposit",
        citizenIds: ["not-a-uuid"],
        settlementId: SETTLEMENT_ID,
        targetId: TARGET_ID,
      });

      expect(result.success).toBe(false);
    });
  });

  describe("husbandry variant", () => {
    it("accepts valid husbandry input", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "husbandry",
        citizenIds: [CITIZEN_ID_1],
        settlementId: SETTLEMENT_ID,
        targetId: TARGET_ID,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("culling variant", () => {
    it("accepts valid culling input", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "culling",
        citizenIds: [],
        settlementId: SETTLEMENT_ID,
        targetId: TARGET_ID,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("trade_route variant", () => {
    it("accepts valid trade_route input with origin", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "trade_route",
        citizenIds: [CITIZEN_ID_1],
        settlementId: SETTLEMENT_ID,
        targetId: TARGET_ID,
        tradeRouteEnd: "origin",
      });

      expect(result.success).toBe(true);
    });

    it("accepts valid trade_route input with destination", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "trade_route",
        citizenIds: [CITIZEN_ID_1],
        settlementId: SETTLEMENT_ID,
        targetId: TARGET_ID,
        tradeRouteEnd: "destination",
      });

      expect(result.success).toBe(true);
    });

    it("rejects trade_route without tradeRouteEnd", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "trade_route",
        citizenIds: [CITIZEN_ID_1],
        settlementId: SETTLEMENT_ID,
        targetId: TARGET_ID,
      });

      expect(result.success).toBe(false);
    });

    it("rejects an invalid tradeRouteEnd value", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "trade_route",
        citizenIds: [CITIZEN_ID_1],
        settlementId: SETTLEMENT_ID,
        targetId: TARGET_ID,
        tradeRouteEnd: "middle",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("common rejections", () => {
    it("rejects an unknown assignmentType", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "construction_project",
        citizenIds: [CITIZEN_ID_1],
        settlementId: SETTLEMENT_ID,
        targetId: TARGET_ID,
      });

      expect(result.success).toBe(false);
    });

    it("rejects a missing settlementId", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "deposit",
        citizenIds: [CITIZEN_ID_1],
        targetId: TARGET_ID,
      });

      expect(result.success).toBe(false);
    });

    it("rejects a non-UUID settlementId", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "deposit",
        citizenIds: [CITIZEN_ID_1],
        settlementId: "not-a-uuid",
        targetId: TARGET_ID,
      });

      expect(result.success).toBe(false);
    });

    it("rejects a missing targetId", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "deposit",
        citizenIds: [CITIZEN_ID_1],
        settlementId: SETTLEMENT_ID,
      });

      expect(result.success).toBe(false);
    });

    it("rejects a missing citizenIds array", () => {
      const result = setPerTargetAssignmentInputSchema.safeParse({
        assignmentType: "deposit",
        settlementId: SETTLEMENT_ID,
        targetId: TARGET_ID,
      });

      expect(result.success).toBe(false);
    });
  });
});
