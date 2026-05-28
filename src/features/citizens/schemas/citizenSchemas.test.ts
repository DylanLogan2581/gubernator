import { describe, expect, it } from "vitest";

import {
  assignCitizenRoleInputSchema,
  citizenRoleAssignmentSchema,
} from "./citizenSchemas";

const CITIZEN_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const NATION_ID = "33333333-3333-3333-3333-333333333333";
const SETTLEMENT_ID = "44444444-4444-4444-4444-444444444444";

describe("assignCitizenRoleInputSchema", () => {
  it("accepts nation_manager with a roleNationId and null roleSettlementId", () => {
    const result = assignCitizenRoleInputSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: NATION_ID,
      roleSettlementId: null,
      roleType: "nation_manager",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects nation_manager when roleNationId is null", () => {
    const result = assignCitizenRoleInputSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: null,
      roleSettlementId: null,
      roleType: "nation_manager",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.roleNationId).toContain(
        "Nation manager role requires a role nation.",
      );
    }
  });

  it("rejects nation_manager when roleSettlementId is non-null", () => {
    const result = assignCitizenRoleInputSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: NATION_ID,
      roleSettlementId: SETTLEMENT_ID,
      roleType: "nation_manager",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.roleSettlementId).toContain(
        "Nation manager role must not set a role settlement.",
      );
    }
  });

  it("accepts settlement_manager with a roleSettlementId and null roleNationId", () => {
    const result = assignCitizenRoleInputSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: null,
      roleSettlementId: SETTLEMENT_ID,
      roleType: "settlement_manager",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects settlement_manager when roleSettlementId is null", () => {
    const result = assignCitizenRoleInputSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: null,
      roleSettlementId: null,
      roleType: "settlement_manager",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.roleSettlementId).toContain(
        "Settlement manager role requires a role settlement.",
      );
    }
  });

  it("rejects settlement_manager when roleNationId is non-null", () => {
    const result = assignCitizenRoleInputSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: NATION_ID,
      roleSettlementId: SETTLEMENT_ID,
      roleType: "settlement_manager",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.roleNationId).toContain(
        "Settlement manager role must not set a role nation.",
      );
    }
  });

  it("rejects none as it is not an assignable role type", () => {
    const result = assignCitizenRoleInputSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: null,
      roleSettlementId: null,
      roleType: "none",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("citizenRoleAssignmentSchema", () => {
  it("accepts none with both IDs null", () => {
    const result = citizenRoleAssignmentSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: null,
      roleSettlementId: null,
      roleType: "none",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects none when roleNationId is non-null", () => {
    const result = citizenRoleAssignmentSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: NATION_ID,
      roleSettlementId: null,
      roleType: "none",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.roleNationId).toContain(
        "Role nation must be null when role type is none.",
      );
    }
  });

  it("rejects none when roleSettlementId is non-null", () => {
    const result = citizenRoleAssignmentSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: null,
      roleSettlementId: SETTLEMENT_ID,
      roleType: "none",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.roleSettlementId).toContain(
        "Role settlement must be null when role type is none.",
      );
    }
  });

  it("accepts nation_manager with a roleNationId and null roleSettlementId", () => {
    const result = citizenRoleAssignmentSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: NATION_ID,
      roleSettlementId: null,
      roleType: "nation_manager",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects nation_manager when roleNationId is null", () => {
    const result = citizenRoleAssignmentSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: null,
      roleSettlementId: null,
      roleType: "nation_manager",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.roleNationId).toContain(
        "Nation manager role requires a role nation.",
      );
    }
  });

  it("rejects nation_manager when roleSettlementId is non-null", () => {
    const result = citizenRoleAssignmentSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: NATION_ID,
      roleSettlementId: SETTLEMENT_ID,
      roleType: "nation_manager",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.roleSettlementId).toContain(
        "Nation manager role must not set a role settlement.",
      );
    }
  });

  it("accepts settlement_manager with a roleSettlementId and null roleNationId", () => {
    const result = citizenRoleAssignmentSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: null,
      roleSettlementId: SETTLEMENT_ID,
      roleType: "settlement_manager",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects settlement_manager when roleSettlementId is null", () => {
    const result = citizenRoleAssignmentSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: null,
      roleSettlementId: null,
      roleType: "settlement_manager",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.roleSettlementId).toContain(
        "Settlement manager role requires a role settlement.",
      );
    }
  });

  it("rejects settlement_manager when roleNationId is non-null", () => {
    const result = citizenRoleAssignmentSchema.safeParse({
      citizenId: CITIZEN_ID,
      roleNationId: NATION_ID,
      roleSettlementId: SETTLEMENT_ID,
      roleType: "settlement_manager",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.roleNationId).toContain(
        "Settlement manager role must not set a role nation.",
      );
    }
  });
});
