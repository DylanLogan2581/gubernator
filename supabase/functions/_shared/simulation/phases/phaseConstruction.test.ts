// Unit tests for phaseConstruction — worker-turn progress accumulation,
// completion boundary, stockpile deduction, and pool/per-project worker
// distribution across a settlement's project queue.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseConstruction } from "./phaseConstruction.ts";
import {
  makeAssignment,
  makeCitizen,
  makeContext,
  makeSettlement,
} from "./testFixtures.ts";

import type {
  SimBuildingTier,
  SimConstructionProject,
  SimStockpile,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Local fixture helpers
// ---------------------------------------------------------------------------

function makeBuildingTier(
  overrides?: Partial<SimBuildingTier>,
): SimBuildingTier {
  return {
    buildingBlueprintId: "blueprint-1",
    constructionCostsJson: [{ amount: 1, resourceId: "wood" }],
    effectsJson: [],
    id: "tier-1",
    tierNumber: 1,
    upkeepCostsJson: [],
    workerTurnsRequired: 100,
    ...overrides,
  };
}

function makeConstructionProject(
  overrides: Partial<SimConstructionProject> & {
    id: string;
    settlementId: string;
    targetTierId: string;
  },
): SimConstructionProject {
  return {
    buildingBlueprintId: "blueprint-1",
    progressWorkerTurns: 0,
    queuePosition: 0,
    status: "queued",
    workerTurnsRequired: 100,
    ...overrides,
  };
}

function makeStockpile(
  overrides: Partial<SimStockpile> & { resourceId: string; settlementId: string },
): SimStockpile {
  return {
    cap: 1000,
    quantity: 1000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseConstruction — worker-turn progress accumulation", () => {
  it("accumulates progress equal to explicit per-project worker count", () => {
    const tier = makeBuildingTier();
    const project = makeConstructionProject({
      id: "p1",
      progressWorkerTurns: 0,
      settlementId: "s1",
      status: "queued",
      targetTierId: tier.id,
      workerTurnsRequired: 100,
    });

    const ctx = makeContext({
      buildingTiers: [tier],
      citizenAssignments: [
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c1",
          constructionProjectId: "p1",
        }),
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c2",
          constructionProjectId: "p1",
        }),
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c3",
          constructionProjectId: "p1",
        }),
      ],
      citizens: [
        makeCitizen({ id: "c1", settlementId: "s1" }),
        makeCitizen({ id: "c2", settlementId: "s1" }),
        makeCitizen({ id: "c3", settlementId: "s1" }),
      ],
      constructionProjects: [project],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [makeStockpile({ quantity: 10, resourceId: "wood", settlementId: "s1" })],
    });

    const result = phaseConstruction(ctx);

    expect(result.constructionUpdates).toEqual([
      {
        progressWorkerTurnsDelta: 3,
        projectId: "p1",
        settlementId: "s1",
        toStatus: "in_progress",
      },
    ]);
    expect(result.buildingsCreated).toHaveLength(0);
    expect(result.assignmentClears).toHaveLength(0);

    const log = result.logs.find((l) => l.category === "construction.progress");
    expect(log).toBeDefined();
    expect(log?.payload).toMatchObject({ newProgress: 3, workers: 3 });
  });

  it("deducts stockpile equal to cost-per-worker times worker count", () => {
    const tier = makeBuildingTier({
      constructionCostsJson: [{ amount: 2, resourceId: "wood" }],
    });
    const project = makeConstructionProject({
      id: "p1",
      settlementId: "s1",
      status: "in_progress",
      targetTierId: tier.id,
    });

    const ctx = makeContext({
      buildingTiers: [tier],
      citizenAssignments: [
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c1",
          constructionProjectId: "p1",
        }),
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c2",
          constructionProjectId: "p1",
        }),
      ],
      citizens: [
        makeCitizen({ id: "c1", settlementId: "s1" }),
        makeCitizen({ id: "c2", settlementId: "s1" }),
      ],
      constructionProjects: [project],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [makeStockpile({ quantity: 50, resourceId: "wood", settlementId: "s1" })],
    });

    const result = phaseConstruction(ctx);

    // 2 workers * 2 amount = 4 consumed
    expect(result.stockpileDeltas).toEqual([
      { delta: -4, resourceId: "wood", settlementId: "s1" },
    ]);
  });

  it("completes exactly when progress meets the required cost (boundary)", () => {
    const tier = makeBuildingTier({ workerTurnsRequired: 100 });
    const project = makeConstructionProject({
      id: "p1",
      progressWorkerTurns: 97,
      settlementId: "s1",
      status: "in_progress",
      targetTierId: tier.id,
      workerTurnsRequired: 100,
    });

    const ctx = makeContext({
      buildingTiers: [tier],
      citizenAssignments: [
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c1",
          constructionProjectId: "p1",
        }),
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c2",
          constructionProjectId: "p1",
        }),
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c3",
          constructionProjectId: "p1",
        }),
      ],
      citizens: [
        makeCitizen({ id: "c1", settlementId: "s1" }),
        makeCitizen({ id: "c2", settlementId: "s1" }),
        makeCitizen({ id: "c3", settlementId: "s1" }),
      ],
      constructionProjects: [project],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [makeStockpile({ quantity: 100, resourceId: "wood", settlementId: "s1" })],
    });

    const result = phaseConstruction(ctx);

    // progress 97 + 3 workers = 100 === required -> complete
    expect(result.constructionUpdates).toEqual([
      {
        progressWorkerTurnsDelta: 3,
        projectId: "p1",
        settlementId: "s1",
        toStatus: "complete",
      },
    ]);
    expect(result.buildingsCreated).toEqual([
      { buildingBlueprintId: "blueprint-1", settlementId: "s1", tierId: tier.id },
    ]);
    expect(result.assignmentClears).toEqual(
      expect.arrayContaining([
        { citizenId: "c1", reason: "construction_project_completed" },
        { citizenId: "c2", reason: "construction_project_completed" },
        { citizenId: "c3", reason: "construction_project_completed" },
      ]),
    );
    expect(result.assignmentClears).toHaveLength(3);

    const completedLog = result.logs.find((l) => l.category === "construction.completed");
    expect(completedLog).toBeDefined();

    const completedNotification = result.notifications.find(
      (n) => n.notificationType === "construction.completed",
    );
    expect(completedNotification).toBeDefined();
  });

  it("does not complete one worker-turn below the required cost", () => {
    const tier = makeBuildingTier({ workerTurnsRequired: 100 });
    const project = makeConstructionProject({
      id: "p1",
      progressWorkerTurns: 96,
      settlementId: "s1",
      status: "in_progress",
      targetTierId: tier.id,
      workerTurnsRequired: 100,
    });

    const ctx = makeContext({
      buildingTiers: [tier],
      citizenAssignments: [
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c1",
          constructionProjectId: "p1",
        }),
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c2",
          constructionProjectId: "p1",
        }),
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c3",
          constructionProjectId: "p1",
        }),
      ],
      citizens: [
        makeCitizen({ id: "c1", settlementId: "s1" }),
        makeCitizen({ id: "c2", settlementId: "s1" }),
        makeCitizen({ id: "c3", settlementId: "s1" }),
      ],
      constructionProjects: [project],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [makeStockpile({ quantity: 100, resourceId: "wood", settlementId: "s1" })],
    });

    const result = phaseConstruction(ctx);

    // progress 96 + 3 workers = 99 < 100 required -> stays in progress, no completion
    expect(result.constructionUpdates).toEqual([
      {
        progressWorkerTurnsDelta: 3,
        projectId: "p1",
        settlementId: "s1",
        // status was already in_progress, so toStatus stays null (unchanged)
        toStatus: null,
      },
    ]);
    expect(result.buildingsCreated).toHaveLength(0);
    expect(result.assignmentClears).toHaveLength(0);
    expect(result.logs.find((l) => l.category === "construction.completed")).toBeUndefined();
    expect(result.logs.find((l) => l.category === "construction.progress")).toBeDefined();
  });

  it("transitions toStatus to in_progress only when leaving queued status", () => {
    const tier = makeBuildingTier({ workerTurnsRequired: 100 });
    const project = makeConstructionProject({
      id: "p1",
      progressWorkerTurns: 0,
      settlementId: "s1",
      status: "queued",
      targetTierId: tier.id,
      workerTurnsRequired: 100,
    });

    const ctx = makeContext({
      buildingTiers: [tier],
      citizenAssignments: [
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c1",
          constructionProjectId: "p1",
        }),
      ],
      citizens: [makeCitizen({ id: "c1", settlementId: "s1" })],
      constructionProjects: [project],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [makeStockpile({ quantity: 10, resourceId: "wood", settlementId: "s1" })],
    });

    const result = phaseConstruction(ctx);

    expect(result.constructionUpdates[0]?.toStatus).toBe("in_progress");
  });

  it("pauses a project and applies zero progress when the stockpile cannot cover costs", () => {
    const tier = makeBuildingTier({
      constructionCostsJson: [{ amount: 10, resourceId: "wood" }],
    });
    const project = makeConstructionProject({
      id: "p1",
      progressWorkerTurns: 0,
      settlementId: "s1",
      status: "in_progress",
      targetTierId: tier.id,
    });

    const ctx = makeContext({
      buildingTiers: [tier],
      citizenAssignments: [
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c1",
          constructionProjectId: "p1",
        }),
      ],
      citizens: [makeCitizen({ id: "c1", settlementId: "s1" })],
      constructionProjects: [project],
      settlements: [makeSettlement({ id: "s1" })],
      // Only 5 wood available, but 10 required for 1 worker -> insufficient
      stockpiles: [makeStockpile({ quantity: 5, resourceId: "wood", settlementId: "s1" })],
    });

    const result = phaseConstruction(ctx);

    expect(result.constructionUpdates).toEqual([
      {
        progressWorkerTurnsDelta: 0,
        projectId: "p1",
        settlementId: "s1",
        toStatus: "paused",
      },
    ]);
    expect(result.stockpileDeltas).toHaveLength(0);
    expect(result.logs.find((l) => l.category === "construction.paused")).toBeDefined();
    expect(
      result.notifications.find((n) => n.notificationType === "construction.paused"),
    ).toBeDefined();
  });

  it("skips a queued project entirely once the settlement's pool workers are exhausted", () => {
    const tier = makeBuildingTier();
    const project1 = makeConstructionProject({
      id: "p1",
      queuePosition: 0,
      settlementId: "s1",
      status: "queued",
      targetTierId: tier.id,
    });
    const project2 = makeConstructionProject({
      id: "p2",
      queuePosition: 1,
      settlementId: "s1",
      status: "queued",
      targetTierId: tier.id,
    });

    const ctx = makeContext({
      buildingTiers: [tier],
      citizenAssignments: [
        // Pool worker (no explicit project assignment) — fills only project 1.
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "c1",
          constructionProjectId: null,
        }),
      ],
      citizens: [makeCitizen({ id: "c1", settlementId: "s1" })],
      constructionProjects: [project1, project2],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [makeStockpile({ quantity: 10, resourceId: "wood", settlementId: "s1" })],
    });

    const result = phaseConstruction(ctx);

    const updateIds = result.constructionUpdates.map((u) => u.projectId);
    expect(updateIds).toEqual(["p1"]);
    expect(result.constructionUpdates[0]?.progressWorkerTurnsDelta).toBe(1);
  });

  it("isolates progress and stockpiles per settlement for independent projects", () => {
    const tier = makeBuildingTier();
    const projectA = makeConstructionProject({
      id: "pa",
      settlementId: "s1",
      status: "in_progress",
      targetTierId: tier.id,
    });
    const projectB = makeConstructionProject({
      id: "pb",
      settlementId: "s2",
      status: "in_progress",
      targetTierId: tier.id,
    });

    const ctx = makeContext({
      buildingTiers: [tier],
      citizenAssignments: [
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "ca",
          constructionProjectId: "pa",
        }),
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "cb1",
          constructionProjectId: "pb",
        }),
        makeAssignment({
          assignmentType: "construction_project",
          citizenId: "cb2",
          constructionProjectId: "pb",
        }),
      ],
      citizens: [
        makeCitizen({ id: "ca", settlementId: "s1" }),
        makeCitizen({ id: "cb1", settlementId: "s2" }),
        makeCitizen({ id: "cb2", settlementId: "s2" }),
      ],
      constructionProjects: [projectA, projectB],
      settlements: [makeSettlement({ id: "s1" }), makeSettlement({ id: "s2" })],
      stockpiles: [
        makeStockpile({ quantity: 10, resourceId: "wood", settlementId: "s1" }),
        makeStockpile({ quantity: 10, resourceId: "wood", settlementId: "s2" }),
      ],
    });

    const result = phaseConstruction(ctx);

    const updateA = result.constructionUpdates.find((u) => u.projectId === "pa");
    const updateB = result.constructionUpdates.find((u) => u.projectId === "pb");
    expect(updateA?.progressWorkerTurnsDelta).toBe(1);
    expect(updateB?.progressWorkerTurnsDelta).toBe(2);

    expect(result.stockpileDeltas).toEqual(
      expect.arrayContaining([
        { delta: -1, resourceId: "wood", settlementId: "s1" },
        { delta: -2, resourceId: "wood", settlementId: "s2" },
      ]),
    );
  });
});
