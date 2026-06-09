import { describe, expect, it } from "vitest";

import {
  createPartnershipInputSchema,
  reassignPartnerInputSchema,
} from "./partnershipSchemas";

const CITIZEN_A_ID = "11111111-1111-1111-1111-111111111111";
const CITIZEN_B_ID = "22222222-2222-2222-2222-222222222222";
const PARTNERSHIP_ID = "33333333-3333-3333-3333-333333333333";
const TURN_TRANSITION_ID = "44444444-4444-4444-4444-444444444444";

describe("createPartnershipInputSchema", () => {
  it("accepts a valid active partnership without an end turn", () => {
    const result = createPartnershipInputSchema.safeParse({
      changeReason: "Married in spring.",
      citizenAId: CITIZEN_A_ID,
      citizenBId: CITIZEN_B_ID,
      formedOnTurnNumber: 1,
      status: "active",
      turnTransitionId: TURN_TRANSITION_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid active partnership when status is omitted", () => {
    const result = createPartnershipInputSchema.safeParse({
      changeReason: "Married in spring.",
      citizenAId: CITIZEN_A_ID,
      citizenBId: CITIZEN_B_ID,
      formedOnTurnNumber: 1,
      turnTransitionId: TURN_TRANSITION_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid widowed partnership with an end turn", () => {
    const result = createPartnershipInputSchema.safeParse({
      changeReason: "Partner died in battle.",
      citizenAId: CITIZEN_A_ID,
      citizenBId: CITIZEN_B_ID,
      endedOnTurnNumber: 5,
      formedOnTurnNumber: 1,
      status: "widowed",
      turnTransitionId: TURN_TRANSITION_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a self-partnership", () => {
    const result = createPartnershipInputSchema.safeParse({
      changeReason: "Self-marriage attempt.",
      citizenAId: CITIZEN_A_ID,
      citizenBId: CITIZEN_A_ID,
      formedOnTurnNumber: 1,
      status: "active",
      turnTransitionId: TURN_TRANSITION_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.citizenBId).toContain(
        "A citizen cannot partner with themselves.",
      );
    }
  });

  it("rejects an active partnership with an end turn", () => {
    const result = createPartnershipInputSchema.safeParse({
      changeReason: "Married in spring.",
      citizenAId: CITIZEN_A_ID,
      citizenBId: CITIZEN_B_ID,
      endedOnTurnNumber: 4,
      formedOnTurnNumber: 1,
      status: "active",
      turnTransitionId: TURN_TRANSITION_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.endedOnTurnNumber).toContain(
        "Active partnerships must not have an end turn.",
      );
    }
  });

  it("rejects a widowed partnership without an end turn", () => {
    const result = createPartnershipInputSchema.safeParse({
      changeReason: "Partner died.",
      citizenAId: CITIZEN_A_ID,
      citizenBId: CITIZEN_B_ID,
      formedOnTurnNumber: 1,
      status: "widowed",
      turnTransitionId: TURN_TRANSITION_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.endedOnTurnNumber).toContain(
        "Widowed partnerships require an end turn.",
      );
    }
  });
});

describe("reassignPartnerInputSchema", () => {
  it("accepts distinct retained and new partner citizens", () => {
    const result = reassignPartnerInputSchema.safeParse({
      changeReason: "Moved on.",
      endedOnTurnNumber: 8,
      formedOnTurnNumber: 9,
      newPartnerCitizenId: CITIZEN_B_ID,
      oldPartnershipId: PARTNERSHIP_ID,
      retainedCitizenId: CITIZEN_A_ID,
      turnTransitionId: TURN_TRANSITION_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects reassigning to the same citizen as the retained citizen", () => {
    const result = reassignPartnerInputSchema.safeParse({
      changeReason: "Same partner.",
      endedOnTurnNumber: 8,
      formedOnTurnNumber: 9,
      newPartnerCitizenId: CITIZEN_A_ID,
      oldPartnershipId: PARTNERSHIP_ID,
      retainedCitizenId: CITIZEN_A_ID,
      turnTransitionId: TURN_TRANSITION_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.newPartnerCitizenId).toContain(
        "Reassigned partner must differ from the retained citizen.",
      );
    }
  });
});
