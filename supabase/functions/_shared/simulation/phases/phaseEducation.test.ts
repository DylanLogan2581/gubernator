// Unit tests for phaseEducation — enrollment progress, teacher staffing,
// graduation/auto-continue, and inactive-building no-op.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseEducation } from "./phaseEducation.ts";
import {
  makeAssignment,
  makeCitizen,
  makeContext,
  makeEducationLevel,
  makeEnrollment,
  makeNationOffice,
  makeSettlement,
} from "./testFixtures.ts";

import type {
  SimBuildingBlueprint,
  SimBuildingTier,
  SimJob,
  SimSettlementBuilding,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Local fixture helpers
// ---------------------------------------------------------------------------

function makeBlueprint(
  overrides: Partial<SimBuildingBlueprint> & { id: string },
): SimBuildingBlueprint {
  return {
    gracePeriodTurns: 0,
    maxInstancesPerSettlement: null,
    name: "Schoolhouse",
    ...overrides,
  };
}

function makeTeacherJob(overrides: Partial<SimJob> & { id: string }): SimJob {
  return {
    baseCapacity: null,
    inputsJson: [],
    jobType: "standard",
    linkedDepositTypeId: null,
    linkedManagedPopulationTypeId: null,
    name: "Teacher",
    outputsJson: [],
    requiredEducationLevelId: null,
    traderCapacityPerWorker: null,
    ...overrides,
  };
}

function makeTier(
  overrides: Partial<SimBuildingTier> & { id: string },
): SimBuildingTier {
  return {
    buildingBlueprintId: "bp1",
    constructionCostsJson: [],
    effectsJson: [
      {
        levels: [
          { fromLevelId: null, toLevelId: "basic", turns: 3 },
          { fromLevelId: "basic", toLevelId: "skilled", turns: 3 },
        ],
        studentsPerTeacher: 5,
        teacherCapacity: 2,
        teacherJobId: "teacher-job",
        type: "education",
      },
    ],
    tierNumber: 1,
    upkeepCostsJson: [],
    workerTurnsRequired: 0,
    ...overrides,
  };
}

function makeBuilding(
  overrides: Partial<SimSettlementBuilding> & { id: string },
): SimSettlementBuilding {
  return {
    activatedOnTurnNumber: 1,
    buildingBlueprintId: "bp1",
    currentTierId: "tier1",
    missedUpkeepCount: 0,
    settlementId: "s1",
    sourceProjectId: null,
    state: "active",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseEducation — progress tick", () => {
  it("increments progress_turns by 1 for a staffed school, no patch/graduation", () => {
    const ctx = makeContext({
      buildingBlueprints: [makeBlueprint({ id: "bp1" })],
      buildingTiers: [makeTier({ id: "tier1" })],
      citizenAssignments: [makeAssignment({ assignmentType: "standard_job", citizenId: "teacher1", jobId: "teacher-job" })],
      citizens: [
        makeCitizen({ id: "student1", settlementId: "s1" }),
        makeCitizen({ id: "teacher1", settlementId: "s1" }),
      ],
      educationEnrollments: [
        makeEnrollment({
          citizenId: "student1",
          id: "e1",
          progressTurns: 0,
          settlementBuildingId: "b1",
          targetLevelId: "basic",
        }),
      ],
      educationLevels: [
        makeEducationLevel({ id: "basic", rank: 1 }),
        makeEducationLevel({ id: "skilled", rank: 2 }),
      ],
      jobs: [makeTeacherJob({ id: "teacher-job" })],
      settlementBuildings: [makeBuilding({ id: "b1" })],
      settlements: [makeSettlement({ id: "s1" })],
    });

    const result = phaseEducation(ctx, []);

    expect(result.enrollmentProgressUpdates).toEqual([
      { enrollmentId: "e1", progressTurns: 1, targetLevelId: "basic" },
    ]);
    expect(result.citizenEducationPatches).toEqual([]);
    expect(result.enrollmentGraduations).toEqual([]);
    expect(result.logs.some((l) => l.category === "education.understaffed")).toBe(false);
  });
});

describe("phaseEducation — understaffed stall", () => {
  it("emits an understaffed log and leaves the enrollment untouched when no teacher is assigned", () => {
    const ctx = makeContext({
      buildingBlueprints: [makeBlueprint({ id: "bp1" })],
      buildingTiers: [makeTier({ id: "tier1" })],
      citizenAssignments: [],
      citizens: [makeCitizen({ id: "student1", settlementId: "s1" })],
      educationEnrollments: [
        makeEnrollment({
          citizenId: "student1",
          id: "e1",
          progressTurns: 0,
          settlementBuildingId: "b1",
          targetLevelId: "basic",
        }),
      ],
      educationLevels: [
        makeEducationLevel({ id: "basic", rank: 1 }),
        makeEducationLevel({ id: "skilled", rank: 2 }),
      ],
      jobs: [makeTeacherJob({ id: "teacher-job" })],
      settlementBuildings: [makeBuilding({ id: "b1" })],
      settlements: [makeSettlement({ id: "s1" })],
    });

    const result = phaseEducation(ctx, []);

    expect(result.enrollmentProgressUpdates).toEqual([]);
    expect(result.citizenEducationPatches).toEqual([]);
    const understaffed = result.logs.find((l) => l.category === "education.understaffed");
    expect(understaffed).toBeDefined();
    expect(understaffed?.payload).toMatchObject({
      settlementBuildingId: "b1",
      studentCount: 1,
      teacherCount: 0,
    });
  });
});

describe("phaseEducation — level-up with auto-continue", () => {
  it("patches the citizen's level and retargets the enrollment to the next level when the school teaches higher", () => {
    const ctx = makeContext({
      buildingBlueprints: [makeBlueprint({ id: "bp1" })],
      buildingTiers: [makeTier({ id: "tier1" })],
      citizenAssignments: [makeAssignment({ assignmentType: "standard_job", citizenId: "teacher1", jobId: "teacher-job" })],
      citizens: [
        makeCitizen({ id: "student1", settlementId: "s1" }),
        makeCitizen({ id: "teacher1", settlementId: "s1" }),
      ],
      educationEnrollments: [
        makeEnrollment({
          citizenId: "student1",
          id: "e1",
          progressTurns: 2,
          settlementBuildingId: "b1",
          targetLevelId: "basic",
        }),
      ],
      educationLevels: [
        makeEducationLevel({ id: "basic", rank: 1 }),
        makeEducationLevel({ id: "skilled", rank: 2 }),
      ],
      jobs: [makeTeacherJob({ id: "teacher-job" })],
      settlementBuildings: [makeBuilding({ id: "b1" })],
      settlements: [makeSettlement({ id: "s1" })],
    });

    const result = phaseEducation(ctx, []);

    expect(result.citizenEducationPatches).toEqual([
      { citizenId: "student1", educationLevelId: "basic" },
    ]);
    expect(result.enrollmentProgressUpdates).toEqual([
      { enrollmentId: "e1", progressTurns: 0, targetLevelId: "skilled" },
    ]);
    expect(result.enrollmentGraduations).toEqual([]);

    const summary = result.educationSummaryBySettlementId.get("s1");
    expect(summary?.graduationsThisTurn).toBe(1);
    expect(summary?.countsByLevelId).toEqual({ skilled: 1 });

    const gradLog = result.logs.find((l) => l.category === "education.graduated");
    expect(gradLog).toBeDefined();
    expect(result.notifications.some((n) => n.notificationType === "education.graduated")).toBe(
      true,
    );
  });
});

describe("phaseEducation — graduation and unenroll", () => {
  it("unenrolls the citizen when the school teaches nothing beyond the level just reached", () => {
    const ctx = makeContext({
      buildingBlueprints: [makeBlueprint({ id: "bp1" })],
      buildingTiers: [
        makeTier({
          effectsJson: [
            {
              levels: [{ fromLevelId: null, toLevelId: "basic", turns: 3 }],
              studentsPerTeacher: 5,
              teacherCapacity: 2,
              teacherJobId: "teacher-job",
              type: "education",
            },
          ],
          id: "tier1",
        }),
      ],
      citizenAssignments: [makeAssignment({ assignmentType: "standard_job", citizenId: "teacher1", jobId: "teacher-job" })],
      citizens: [
        makeCitizen({ id: "student1", settlementId: "s1" }),
        makeCitizen({ id: "teacher1", settlementId: "s1" }),
      ],
      educationEnrollments: [
        makeEnrollment({
          citizenId: "student1",
          id: "e1",
          progressTurns: 2,
          settlementBuildingId: "b1",
          targetLevelId: "basic",
        }),
      ],
      educationLevels: [
        makeEducationLevel({ id: "basic", rank: 1 }),
        makeEducationLevel({ id: "skilled", rank: 2 }),
      ],
      jobs: [makeTeacherJob({ id: "teacher-job" })],
      settlementBuildings: [makeBuilding({ id: "b1" })],
      settlements: [makeSettlement({ id: "s1" })],
    });

    const result = phaseEducation(ctx, []);

    expect(result.citizenEducationPatches).toEqual([
      { citizenId: "student1", educationLevelId: "basic" },
    ]);
    expect(result.enrollmentGraduations).toEqual([{ enrollmentId: "e1" }]);
    expect(result.enrollmentProgressUpdates).toEqual([]);

    const summary = result.educationSummaryBySettlementId.get("s1");
    expect(summary?.graduationsThisTurn).toBe(1);
    expect(summary?.countsByLevelId).toEqual({});
  });
});

describe("phaseEducation — teacher labor exclusions", () => {
  it("excludes an officeholder teacher from the staffing count, causing understaffed stall", () => {
    const ctx = makeContext({
      buildingBlueprints: [makeBlueprint({ id: "bp1" })],
      buildingTiers: [makeTier({ id: "tier1" })],
      citizenAssignments: [
        makeAssignment({ assignmentType: "standard_job", citizenId: "teacher1", jobId: "teacher-job" }),
      ],
      citizens: [
        makeCitizen({ id: "student1", settlementId: "s1" }),
        makeCitizen({ id: "teacher1", settlementId: "s1" }),
      ],
      educationEnrollments: [
        makeEnrollment({
          citizenId: "student1",
          id: "e1",
          progressTurns: 0,
          settlementBuildingId: "b1",
          targetLevelId: "basic",
        }),
      ],
      educationLevels: [
        makeEducationLevel({ id: "basic", rank: 1 }),
        makeEducationLevel({ id: "skilled", rank: 2 }),
      ],
      jobs: [makeTeacherJob({ id: "teacher-job" })],
      nationOffices: [makeNationOffice({ citizenId: "teacher1" })],
      settlementBuildings: [makeBuilding({ id: "b1" })],
      settlements: [makeSettlement({ id: "s1" })],
    });

    const result = phaseEducation(ctx, []);

    expect(result.enrollmentProgressUpdates).toEqual([]);
    const understaffed = result.logs.find((l) => l.category === "education.understaffed");
    expect(understaffed).toBeDefined();
    expect(understaffed?.payload).toMatchObject({ teacherCount: 0 });
  });

  it("excludes an enrolled-student teacher from the staffing count", () => {
    const ctx = makeContext({
      buildingBlueprints: [makeBlueprint({ id: "bp1" })],
      buildingTiers: [makeTier({ id: "tier1" })],
      citizenAssignments: [
        makeAssignment({ assignmentType: "standard_job", citizenId: "teacher1", jobId: "teacher-job" }),
      ],
      citizens: [
        makeCitizen({ id: "student1", settlementId: "s1" }),
        makeCitizen({ id: "teacher1", settlementId: "s1" }),
      ],
      educationEnrollments: [
        makeEnrollment({
          citizenId: "student1",
          id: "e1",
          progressTurns: 0,
          settlementBuildingId: "b1",
          targetLevelId: "basic",
        }),
        makeEnrollment({
          citizenId: "teacher1",
          id: "e2",
          progressTurns: 0,
          settlementBuildingId: "b2",
          targetLevelId: "basic",
        }),
      ],
      educationLevels: [
        makeEducationLevel({ id: "basic", rank: 1 }),
        makeEducationLevel({ id: "skilled", rank: 2 }),
      ],
      jobs: [makeTeacherJob({ id: "teacher-job" })],
      settlementBuildings: [makeBuilding({ id: "b1" })],
      settlements: [makeSettlement({ id: "s1" })],
    });

    const result = phaseEducation(ctx, []);

    const understaffed = result.logs.find((l) => l.category === "education.understaffed");
    expect(understaffed).toBeDefined();
    expect(understaffed?.payload).toMatchObject({ teacherCount: 0 });
  });

  it("excludes an enlisted-soldier teacher from the staffing count", () => {
    const ctx = makeContext({
      buildingBlueprints: [makeBlueprint({ id: "bp1" })],
      buildingTiers: [makeTier({ id: "tier1" })],
      citizenAssignments: [
        makeAssignment({ assignmentType: "standard_job", citizenId: "teacher1", jobId: "teacher-job" }),
      ],
      citizens: [
        makeCitizen({ id: "student1", settlementId: "s1" }),
        makeCitizen({ id: "teacher1", settlementId: "s1" }),
      ],
      educationEnrollments: [
        makeEnrollment({
          citizenId: "student1",
          id: "e1",
          progressTurns: 0,
          settlementBuildingId: "b1",
          targetLevelId: "basic",
        }),
      ],
      educationLevels: [
        makeEducationLevel({ id: "basic", rank: 1 }),
        makeEducationLevel({ id: "skilled", rank: 2 }),
      ],
      jobs: [makeTeacherJob({ id: "teacher-job" })],
      settlementBuildings: [makeBuilding({ id: "b1" })],
      settlements: [makeSettlement({ id: "s1" })],
      unitSoldiers: [
        { citizenId: "teacher1", homeSettlementId: "s1", id: "sol1", unitId: "u1" },
      ],
    });

    const result = phaseEducation(ctx, []);

    const understaffed = result.logs.find((l) => l.category === "education.understaffed");
    expect(understaffed).toBeDefined();
    expect(understaffed?.payload).toMatchObject({ teacherCount: 0 });
  });
});

describe("phaseEducation — inactive building no-op", () => {
  it("does nothing for a school whose building went inactive this turn, even if it would otherwise be staffed", () => {
    const ctx = makeContext({
      buildingBlueprints: [makeBlueprint({ id: "bp1" })],
      buildingTiers: [makeTier({ id: "tier1" })],
      citizenAssignments: [makeAssignment({ assignmentType: "standard_job", citizenId: "teacher1", jobId: "teacher-job" })],
      citizens: [
        makeCitizen({ id: "student1", settlementId: "s1" }),
        makeCitizen({ id: "teacher1", settlementId: "s1" }),
      ],
      educationEnrollments: [
        makeEnrollment({
          citizenId: "student1",
          id: "e1",
          progressTurns: 0,
          settlementBuildingId: "b1",
          targetLevelId: "basic",
        }),
      ],
      educationLevels: [
        makeEducationLevel({ id: "basic", rank: 1 }),
        makeEducationLevel({ id: "skilled", rank: 2 }),
      ],
      jobs: [makeTeacherJob({ id: "teacher-job" })],
      settlementBuildings: [makeBuilding({ id: "b1", state: "active" })],
      settlements: [makeSettlement({ id: "s1" })],
    });

    const result = phaseEducation(ctx, [
      { missedUpkeepCountDelta: null, settlementBuildingId: "b1", toState: "suspended" },
    ]);

    expect(result.enrollmentProgressUpdates).toEqual([]);
    expect(result.citizenEducationPatches).toEqual([]);
    expect(result.enrollmentGraduations).toEqual([]);
    expect(result.logs).toEqual([]);

    // Enrollment still counts toward the summary even though it's a no-op.
    const summary = result.educationSummaryBySettlementId.get("s1");
    expect(summary?.countsByLevelId).toEqual({ basic: 1 });
    expect(summary?.graduationsThisTurn).toBe(0);
  });
});
