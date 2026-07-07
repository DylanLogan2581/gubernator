// Unit tests for phaseDepositExtraction — worker/output arithmetic,
// remaining-quantity clamping, stockpile-cap throttling, depletion, and
// multi-deposit/settlement isolation.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseDepositExtraction } from "./phaseDepositExtraction.ts";
import { makeAssignment, makeContext, makeSettlement } from "./testFixtures.ts";

import type {
  SimDeposit,
  SimDepositResource,
  SimDepositType,
  SimStockpile,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Local fixture helpers
// ---------------------------------------------------------------------------

function makeDepositType(overrides?: Partial<SimDepositType>): SimDepositType {
  return {
    id: "dtype-1",
    jobId: "job-deposit",
    name: "Iron Vein",
    outputUnitsPerWorker: 10,
    workerInputsJson: [],
    ...overrides,
  };
}

function makeDepositResource(
  overrides: Partial<SimDepositResource> & {
    depositInstanceId: string;
    resourceId: string;
  },
): SimDepositResource {
  return {
    id: `${overrides.depositInstanceId}-${overrides.resourceId}`,
    remainingQuantity: 1000,
    ...overrides,
  };
}

function makeDeposit(
  overrides: Partial<SimDeposit> & { id: string; settlementId: string },
): SimDeposit {
  return {
    depositTypeId: "dtype-1",
    maxWorkers: null,
    name: "Iron Vein",
    resources: [
      makeDepositResource({ depositInstanceId: overrides.id, resourceId: "iron" }),
    ],
    status: "active",
    ...overrides,
  };
}

function makeStockpile(
  overrides: Partial<SimStockpile> & { resourceId: string; settlementId: string },
): SimStockpile {
  return {
    cap: 1000,
    quantity: 0,
    ...overrides,
  };
}

function makeDepositAssignment(
  citizenId: string,
  depositInstanceId: string,
): ReturnType<typeof makeAssignment> {
  return makeAssignment({
    assignmentType: "deposit" as const,
    citizenId,
    depositInstanceId,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseDepositExtraction — extraction arithmetic", () => {
  it("computes total extraction as workers * outputUnitsPerWorker, split proportionally by remaining quantity", () => {
    const depositType = makeDepositType({ outputUnitsPerWorker: 10 });
    const deposit = makeDeposit({
      id: "d1",
      resources: [
        makeDepositResource({ depositInstanceId: "d1", remainingQuantity: 1000, resourceId: "iron" }),
        makeDepositResource({ depositInstanceId: "d1", remainingQuantity: 1000, resourceId: "copper" }),
      ],
      settlementId: "s1",
    });

    const ctx = makeContext({
      citizenAssignments: [
        makeDepositAssignment("c1", "d1"),
        makeDepositAssignment("c2", "d1"),
      ],
      depositTypes: [depositType],
      deposits: [deposit],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [
        makeStockpile({ resourceId: "iron", settlementId: "s1" }),
        makeStockpile({ resourceId: "copper", settlementId: "s1" }),
      ],
    });

    const result = phaseDepositExtraction(ctx);

    // 2 workers * 10 outputUnitsPerWorker = 20 total, split evenly (equal weights) -> 10 each
    const update = result.depositUpdates.find((u) => u.depositInstanceId === "d1");
    expect(update?.toStatus).toBeNull();
    expect(update?.resourceDeltas).toEqual(
      expect.arrayContaining([
        { delta: -10, resourceId: "iron" },
        { delta: -10, resourceId: "copper" },
      ]),
    );

    expect(result.stockpileDeltas).toEqual(
      expect.arrayContaining([
        { delta: 10, resourceId: "iron", settlementId: "s1" },
        { delta: 10, resourceId: "copper", settlementId: "s1" },
      ]),
    );

    const log = result.logs.find((l) => l.category === "deposit.processed");
    expect(log?.payload).toMatchObject({
      inputShortfallScale: 1,
      totalExtraction: 20,
      workers: 2,
    });
  });

  it("clamps extraction at the remaining quantity and depletes the deposit", () => {
    const depositType = makeDepositType({ outputUnitsPerWorker: 10 });
    const deposit = makeDeposit({
      id: "d1",
      resources: [
        makeDepositResource({ depositInstanceId: "d1", remainingQuantity: 5, resourceId: "iron" }),
      ],
      settlementId: "s1",
    });

    const ctx = makeContext({
      citizenAssignments: [makeDepositAssignment("c1", "d1")],
      depositTypes: [depositType],
      deposits: [deposit],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [makeStockpile({ resourceId: "iron", settlementId: "s1" })],
    });

    const result = phaseDepositExtraction(ctx);

    // 1 worker * 10 = 10 raw extraction, but only 5 remains -> capped at 5
    const update = result.depositUpdates.find((u) => u.depositInstanceId === "d1");
    expect(update?.resourceDeltas).toEqual([{ delta: -5, resourceId: "iron" }]);
    expect(update?.toStatus).toBe("depleted");

    expect(result.assignmentClears).toEqual([
      { citizenId: "c1", reason: "deposit_depleted" },
    ]);
    expect(result.logs.find((l) => l.category === "deposit.depleted")).toBeDefined();
    expect(
      result.notifications.find((n) => n.notificationType === "deposit.depleted"),
    ).toBeDefined();
  });

  it("does not deplete when at least one resource still has remaining quantity", () => {
    // proportionalShare gives a zero-weight resource a 0 share, so a resource
    // that was already at 0 stays exhausted while an untouched resource keeps
    // the deposit alive overall (isDepleted requires *every* resource to hit 0).
    const depositType = makeDepositType({ outputUnitsPerWorker: 10 });
    const deposit = makeDeposit({
      id: "d1",
      resources: [
        makeDepositResource({ depositInstanceId: "d1", remainingQuantity: 0, resourceId: "iron" }),
        makeDepositResource({ depositInstanceId: "d1", remainingQuantity: 1000, resourceId: "copper" }),
      ],
      settlementId: "s1",
    });

    const ctx = makeContext({
      citizenAssignments: [makeDepositAssignment("c1", "d1")],
      depositTypes: [depositType],
      deposits: [deposit],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [
        makeStockpile({ resourceId: "iron", settlementId: "s1" }),
        makeStockpile({ resourceId: "copper", settlementId: "s1" }),
      ],
    });

    const result = phaseDepositExtraction(ctx);

    const update = result.depositUpdates.find((u) => u.depositInstanceId === "d1");
    // iron has zero weight so it gets no share; copper takes the full extraction
    expect(update?.resourceDeltas).toEqual([{ delta: -10, resourceId: "copper" }]);
    expect(update?.toStatus).toBeNull();
    expect(result.assignmentClears).toHaveLength(0);
    expect(result.logs.find((l) => l.category === "deposit.depleted")).toBeUndefined();
  });

  it("throttles extraction by available stockpile space, leaving overflow in the deposit", () => {
    const depositType = makeDepositType({ outputUnitsPerWorker: 10 });
    const deposit = makeDeposit({
      id: "d1",
      resources: [
        makeDepositResource({ depositInstanceId: "d1", remainingQuantity: 1000, resourceId: "iron" }),
      ],
      settlementId: "s1",
    });

    const ctx = makeContext({
      citizenAssignments: [makeDepositAssignment("c1", "d1")],
      depositTypes: [depositType],
      deposits: [deposit],
      settlements: [makeSettlement({ id: "s1" })],
      // Only 5 units of space left in the stockpile (cap 100, currently at 95)
      stockpiles: [makeStockpile({ cap: 100, quantity: 95, resourceId: "iron", settlementId: "s1" })],
    });

    const result = phaseDepositExtraction(ctx);

    // Raw extraction would be 10, but only 5 units of stockpile space remain
    const update = result.depositUpdates.find((u) => u.depositInstanceId === "d1");
    expect(update?.resourceDeltas).toEqual([{ delta: -5, resourceId: "iron" }]);
    // Deposit still has 995 remaining -> not depleted despite the throttle
    expect(update?.toStatus).toBeNull();

    expect(result.stockpileDeltas).toEqual(
      expect.arrayContaining([{ delta: 5, resourceId: "iron", settlementId: "s1" }]),
    );
  });

  it("scales extraction down when worker inputs are in short supply", () => {
    const depositType = makeDepositType({
      outputUnitsPerWorker: 10,
      workerInputsJson: [{ amountPerWorker: 5, resourceId: "food" }],
    });
    const deposit = makeDeposit({
      id: "d1",
      resources: [
        makeDepositResource({ depositInstanceId: "d1", remainingQuantity: 1000, resourceId: "iron" }),
      ],
      settlementId: "s1",
    });

    const ctx = makeContext({
      citizenAssignments: [
        makeDepositAssignment("c1", "d1"),
        makeDepositAssignment("c2", "d1"),
      ],
      depositTypes: [depositType],
      deposits: [deposit],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [
        // 2 workers * 5 amountPerWorker = 10 required, only 4 available -> scale 0.4
        makeStockpile({ quantity: 4, resourceId: "food", settlementId: "s1" }),
        makeStockpile({ resourceId: "iron", settlementId: "s1" }),
      ],
    });

    const result = phaseDepositExtraction(ctx);

    const log = result.logs.find((l) => l.category === "deposit.processed");
    expect(log?.payload).toMatchObject({
      inputShortfallScale: 0.4,
      inputsConsumed: { food: 4 },
      totalExtraction: 8, // 2 workers * 10 * 0.4
      workers: 2,
    });

    expect(result.stockpileDeltas).toEqual(
      expect.arrayContaining([
        { delta: -4, resourceId: "food", settlementId: "s1" },
        { delta: 8, resourceId: "iron", settlementId: "s1" },
      ]),
    );
  });

  it("caps worker count at the deposit's maxWorkers", () => {
    const depositType = makeDepositType({ outputUnitsPerWorker: 10 });
    const deposit = makeDeposit({
      id: "d1",
      maxWorkers: 2,
      resources: [
        makeDepositResource({ depositInstanceId: "d1", remainingQuantity: 1000, resourceId: "iron" }),
      ],
      settlementId: "s1",
    });

    const ctx = makeContext({
      citizenAssignments: [
        makeDepositAssignment("c1", "d1"),
        makeDepositAssignment("c2", "d1"),
        makeDepositAssignment("c3", "d1"),
        makeDepositAssignment("c4", "d1"),
        makeDepositAssignment("c5", "d1"),
      ],
      depositTypes: [depositType],
      deposits: [deposit],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [makeStockpile({ resourceId: "iron", settlementId: "s1" })],
    });

    const result = phaseDepositExtraction(ctx);

    // 5 assigned workers, but maxWorkers=2 caps it -> totalExtraction = 2 * 10 = 20
    const log = result.logs.find((l) => l.category === "deposit.processed");
    expect(log?.payload).toMatchObject({ totalExtraction: 20, workers: 2 });
  });

  it("skips a deposit entirely when no workers are assigned", () => {
    const depositType = makeDepositType();
    const deposit = makeDeposit({ id: "d1", settlementId: "s1" });

    const ctx = makeContext({
      citizenAssignments: [],
      depositTypes: [depositType],
      deposits: [deposit],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [makeStockpile({ resourceId: "iron", settlementId: "s1" })],
    });

    const result = phaseDepositExtraction(ctx);

    expect(result.depositUpdates).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
    expect(result.stockpileDeltas).toHaveLength(0);
  });

  it("skips a deposit that is not active", () => {
    const depositType = makeDepositType();
    const deposit = makeDeposit({ id: "d1", settlementId: "s1", status: "depleted" });

    const ctx = makeContext({
      citizenAssignments: [makeDepositAssignment("c1", "d1")],
      depositTypes: [depositType],
      deposits: [deposit],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [makeStockpile({ resourceId: "iron", settlementId: "s1" })],
    });

    const result = phaseDepositExtraction(ctx);

    expect(result.depositUpdates).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
  });

  it("isolates extraction and stockpile deltas across multiple deposits and settlements", () => {
    const depositType = makeDepositType({ outputUnitsPerWorker: 10 });
    const depositA = makeDeposit({
      id: "dA",
      resources: [
        makeDepositResource({ depositInstanceId: "dA", remainingQuantity: 1000, resourceId: "iron" }),
      ],
      settlementId: "s1",
    });
    const depositB = makeDeposit({
      id: "dB",
      resources: [
        makeDepositResource({ depositInstanceId: "dB", remainingQuantity: 1000, resourceId: "iron" }),
      ],
      settlementId: "s2",
    });

    const ctx = makeContext({
      citizenAssignments: [
        makeDepositAssignment("c1", "dA"),
        makeDepositAssignment("c2", "dB"),
        makeDepositAssignment("c3", "dB"),
      ],
      depositTypes: [depositType],
      deposits: [depositA, depositB],
      settlements: [makeSettlement({ id: "s1" }), makeSettlement({ id: "s2" })],
      stockpiles: [
        makeStockpile({ resourceId: "iron", settlementId: "s1" }),
        makeStockpile({ resourceId: "iron", settlementId: "s2" }),
      ],
    });

    const result = phaseDepositExtraction(ctx);

    const updateA = result.depositUpdates.find((u) => u.depositInstanceId === "dA");
    const updateB = result.depositUpdates.find((u) => u.depositInstanceId === "dB");
    expect(updateA?.resourceDeltas).toEqual([{ delta: -10, resourceId: "iron" }]);
    expect(updateB?.resourceDeltas).toEqual([{ delta: -20, resourceId: "iron" }]);

    expect(result.stockpileDeltas).toEqual(
      expect.arrayContaining([
        { delta: 10, resourceId: "iron", settlementId: "s1" },
        { delta: 20, resourceId: "iron", settlementId: "s2" },
      ]),
    );
  });

  it("throws when an active deposit has no resource rows", () => {
    const depositType = makeDepositType();
    const deposit = makeDeposit({ id: "d1", resources: [], settlementId: "s1" });

    const ctx = makeContext({
      citizenAssignments: [makeDepositAssignment("c1", "d1")],
      depositTypes: [depositType],
      deposits: [deposit],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [makeStockpile({ resourceId: "iron", settlementId: "s1" })],
    });

    expect(() => phaseDepositExtraction(ctx)).toThrow(
      /has no resource rows/,
    );
  });
});

describe("phaseDepositExtraction — officeholder exclusion", () => {
  it("excludes a citizen holding a nation office from extraction worker count", () => {
    const depositType = makeDepositType({ outputUnitsPerWorker: 10 });
    const deposit = makeDeposit({
      id: "d1",
      resources: [
        makeDepositResource({ depositInstanceId: "d1", remainingQuantity: 1000, resourceId: "iron" }),
      ],
      settlementId: "s1",
    });
    const baseArgs = {
      citizenAssignments: [
        makeDepositAssignment("c1", "d1"),
        makeDepositAssignment("c2", "d1"),
      ],
      depositTypes: [depositType],
      deposits: [deposit],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [makeStockpile({ resourceId: "iron", settlementId: "s1" })],
    };

    const withoutOffice = phaseDepositExtraction(makeContext(baseArgs));
    const withOffice = phaseDepositExtraction(
      makeContext({ ...baseArgs, nationOffices: [{ citizenId: "c2" }] }),
    );

    const logWithout = withoutOffice.logs.find((l) => l.category === "deposit.processed");
    const logWith = withOffice.logs.find((l) => l.category === "deposit.processed");
    expect(logWithout?.payload).toMatchObject({ totalExtraction: 20, workers: 2 });
    expect(logWith?.payload).toMatchObject({ totalExtraction: 10, workers: 1 });
  });

  it("still clears an officeholder's assignment row when the deposit depletes from other workers", () => {
    const depositType = makeDepositType({ outputUnitsPerWorker: 10 });
    const deposit = makeDeposit({
      id: "d1",
      resources: [
        makeDepositResource({ depositInstanceId: "d1", remainingQuantity: 5, resourceId: "iron" }),
      ],
      settlementId: "s1",
    });

    const ctx = makeContext({
      citizenAssignments: [
        makeDepositAssignment("c1", "d1"),
        makeDepositAssignment("c2", "d1"),
      ],
      depositTypes: [depositType],
      deposits: [deposit],
      nationOffices: [{ citizenId: "c2" }],
      settlements: [makeSettlement({ id: "s1" })],
      stockpiles: [makeStockpile({ resourceId: "iron", settlementId: "s1" })],
    });

    const result = phaseDepositExtraction(ctx);

    expect(result.depositUpdates[0]?.toStatus).toBe("depleted");
    expect(result.assignmentClears).toEqual(
      expect.arrayContaining([
        { citizenId: "c1", reason: "deposit_depleted" },
        { citizenId: "c2", reason: "deposit_depleted" },
      ]),
    );
  });
});
