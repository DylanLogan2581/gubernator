import { describe, expect, it } from "vitest";

import {
  classifyRecruitCandidate,
  computeRecruitCostShortfalls,
  formatRecruitIneligibilityReason,
  type RecruitCandidateCitizen,
} from "./recruitEligibility";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_SETTLEMENT_ID = "22222222-2222-2222-2222-222222222222";
const CITIZEN_ID = "33333333-3333-3333-3333-333333333333";
const LEVEL_BASIC_ID = "44444444-4444-4444-4444-444444444444";
const LEVEL_ADVANCED_ID = "55555555-5555-5555-5555-555555555555";

function baseCitizen(
  overrides: Partial<RecruitCandidateCitizen> = {},
): RecruitCandidateCitizen {
  return {
    educationLevelId: null,
    id: CITIZEN_ID,
    settlementId: SETTLEMENT_ID,
    status: "alive",
    ...overrides,
  };
}

describe("classifyRecruitCandidate", () => {
  it("returns no reasons for a fully eligible citizen", () => {
    const reasons = classifyRecruitCandidate({
      citizen: baseCitizen(),
      enrolledCitizenIds: new Set(),
      levelRankById: new Map(),
      officeholderCitizenIds: new Set(),
      requiredEducationLevelId: null,
      soldierCitizenIds: new Set(),
      targetSettlementId: SETTLEMENT_ID,
    });

    expect(reasons).toEqual([]);
  });

  it("collects every applicable reason rather than stopping at the first", () => {
    const reasons = classifyRecruitCandidate({
      citizen: baseCitizen({
        settlementId: OTHER_SETTLEMENT_ID,
        status: "dead",
      }),
      enrolledCitizenIds: new Set([CITIZEN_ID]),
      levelRankById: new Map(),
      officeholderCitizenIds: new Set([CITIZEN_ID]),
      requiredEducationLevelId: null,
      soldierCitizenIds: new Set([CITIZEN_ID]),
      targetSettlementId: SETTLEMENT_ID,
    });

    expect(reasons).toEqual([
      "not_alive",
      "not_resident",
      "already_soldier",
      "enrolled_in_school",
      "officeholder",
    ]);
  });

  it("flags lacks_education when the citizen's rank is below the requirement", () => {
    const levelRankById = new Map([
      [LEVEL_BASIC_ID, 1],
      [LEVEL_ADVANCED_ID, 2],
    ]);

    const reasons = classifyRecruitCandidate({
      citizen: baseCitizen({ educationLevelId: LEVEL_BASIC_ID }),
      enrolledCitizenIds: new Set(),
      levelRankById,
      officeholderCitizenIds: new Set(),
      requiredEducationLevelId: LEVEL_ADVANCED_ID,
      soldierCitizenIds: new Set(),
      targetSettlementId: SETTLEMENT_ID,
    });

    expect(reasons).toEqual(["lacks_education"]);
  });

  it("does not flag lacks_education when the citizen meets the required rank", () => {
    const levelRankById = new Map([
      [LEVEL_BASIC_ID, 1],
      [LEVEL_ADVANCED_ID, 2],
    ]);

    const reasons = classifyRecruitCandidate({
      citizen: baseCitizen({ educationLevelId: LEVEL_ADVANCED_ID }),
      enrolledCitizenIds: new Set(),
      levelRankById,
      officeholderCitizenIds: new Set(),
      requiredEducationLevelId: LEVEL_ADVANCED_ID,
      soldierCitizenIds: new Set(),
      targetSettlementId: SETTLEMENT_ID,
    });

    expect(reasons).toEqual([]);
  });
});

describe("formatRecruitIneligibilityReason", () => {
  it("includes the required level name for lacks_education", () => {
    expect(formatRecruitIneligibilityReason("lacks_education", "Basic")).toBe(
      "Lacks required education (Basic)",
    );
  });

  it("falls back to a generic message without a level name", () => {
    expect(formatRecruitIneligibilityReason("lacks_education")).toBe(
      "Lacks required education",
    );
  });
});

describe("computeRecruitCostShortfalls", () => {
  it("returns no shortfalls when nothing is selected", () => {
    const shortfalls = computeRecruitCostShortfalls({
      availableByResourceId: new Map(),
      costs: [{ amount: 5, resourceId: "iron" }],
      selectedCount: 0,
    });

    expect(shortfalls).toEqual([]);
  });

  it("flags resources whose stockpile is below the scaled requirement", () => {
    const shortfalls = computeRecruitCostShortfalls({
      availableByResourceId: new Map([
        ["iron", 8],
        ["grain", 100],
      ]),
      costs: [
        { amount: 5, resourceId: "iron" },
        { amount: 2, resourceId: "grain" },
      ],
      selectedCount: 3,
    });

    expect(shortfalls).toEqual([
      { available: 8, required: 15, resourceId: "iron", shortfall: 7 },
    ]);
  });
});
