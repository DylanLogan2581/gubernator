/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, expect, it } from "vitest";

import { phaseEvents } from "./phases/phaseEvents.ts";

import type {
  SimEffect,
  SimEvent,
  SimulationContext,
  SimulationInputState,
} from "./simulationTypes.ts";

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

const CALENDAR_CONFIG: SimulationInputState["calendarConfig"] = {
  dateFormatTemplate: "{year}",
  months: [{ dayCount: 30, index: 0, name: "Jan" }],
  startingDayOfMonth: 1,
  startingMonthIndex: 0,
  startingWeekdayOffset: 0,
  startingYear: 1,
  weekdays: [{ index: 0, name: "Mon" }],
};

const BASE_POPULATION_RULES: SimulationInputState["populationRules"] = {
  fertilityChance: 0,
  foodConsumptionPerCitizen: 0,
  homelessnessDecliningRate: 0,
  incestPreventionDepth: 0,
  maximumFertilityAgeTurns: null,
  minimumPartnershipAgeTurns: 0,
  mourningPeriodTurns: 0,
  partnershipSeekChance: 1.0,
  starvationSeverityMultiplier: 0,
  waterConsumptionPerCitizen: 0,
};

function makeInput(
  overrides: Partial<SimulationInputState>,
): SimulationInputState {
  return {
    buildingBlueprints: [],
    buildingTiers: [],
    calendarConfig: CALENDAR_CONFIG,
    citizenAssignments: [],
    citizens: [],
    constructionProjects: [],
    depositTypes: [],
    deposits: [],
    events: [],
    jobs: [],
    managedPopulationTypes: [],
    managedPopulations: [],
    partnerships: [],
    populationRules: BASE_POPULATION_RULES,
    resources: [
      { decayRate: 0, id: "food" },
      { decayRate: 0, id: "water" },
    ],
    settlementBuildings: [],
    settlements: [{ id: "settlement1", name: "TestCity" }],
    stockpiles: [],
    systemResourceIds: { foodId: "food", freshWaterId: "water" },
    tradeRoutes: [],
    turnNumber: 5,
    worldId: "world1",
    ...overrides,
  };
}

function makeEffect(overrides: Partial<SimEffect>): SimEffect {
  return {
    amountValue: null,
    depositInstanceId: null,
    effectType: "resource_grant",
    id: "eff1",
    isPercent: false,
    jobId: null,
    managedPopulationInstanceId: null,
    multiplierValue: null,
    resourceId: null,
    settlementBuildingId: null,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<SimEvent>): SimEvent {
  return {
    activateOnTransitionAfterTurnNumber: 0,
    durationType: "instant",
    effectPayloadJsonb: {},
    effectType: "resource_grant",
    effects: [],
    id: "evt1",
    remainingTransitions: null,
    status: "active",
    ...overrides,
  };
}

function makeContext(input: SimulationInputState): SimulationContext {
  const pendingStockpiles = new Map<string, number>();
  for (const sp of input.stockpiles) {
    pendingStockpiles.set(`${sp.settlementId}:${sp.resourceId}`, sp.quantity);
  }

  return {
    input,
    shared: {
      pendingDeaths: new Set(),
      pendingEventMultipliers: new Map(),
      pendingManagedPopulationDeltas: new Map(),
      pendingPopCapBySettlement: new Map(),
      pendingStockpiles,
      pendingDepositDestroys: new Set(),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseEvents — resource_grant", () => {
  it("adds resource to settlement stockpile", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            amount: 100,
            resourceId: "food",
            settlementId: "settlement1",
          },
          effectType: "resource_grant",
        }),
      ],
      stockpiles: [{ cap: 500, quantity: 0, resourceId: "food", settlementId: "settlement1" }],
    });
    const context = makeContext(input);

    phaseEvents(context);

    const key = "settlement1:food";
    const finalQty = context.shared.pendingStockpiles.get(key) ?? 0;
    expect(finalQty).toBe(100);
  });

  it("accumulates multiple grants to same resource", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: { amount: 50, resourceId: "food", settlementId: "settlement1" },
          effectType: "resource_grant",
          id: "evt1",
        }),
        makeEvent({
          effectPayloadJsonb: { amount: 30, resourceId: "food", settlementId: "settlement1" },
          effectType: "resource_grant",
          id: "evt2",
        }),
      ],
      stockpiles: [{ cap: 500, quantity: 0, resourceId: "food", settlementId: "settlement1" }],
    });
    const context = makeContext(input);

    phaseEvents(context);

    const key = "settlement1:food";
    const finalQty = context.shared.pendingStockpiles.get(key) ?? 0;
    expect(finalQty).toBe(80);
  });

  it("logs resource_grant event", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: { amount: 100, resourceId: "food", settlementId: "settlement1" },
          effectType: "resource_grant",
          id: "evt123",
        }),
      ],
      stockpiles: [{ cap: 500, quantity: 0, resourceId: "food", settlementId: "settlement1" }],
    });
    const context = makeContext(input);

    const result = phaseEvents(context);

    expect(result.logs).toContainEqual(
      expect.objectContaining({
        category: "event.resource_grant",
        payload: expect.objectContaining({
          amount: 100,
          eventId: "evt123",
          resourceId: "food",
          settlementId: "settlement1",
        }),
      }),
    );
  });
});

describe("phaseEvents — resource_drain", () => {
  it("removes resource from settlement stockpile", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            amount: 30,
            resourceId: "food",
            settlementId: "settlement1",
          },
          effectType: "resource_drain",
        }),
      ],
      stockpiles: [{ cap: 500, quantity: 100, resourceId: "food", settlementId: "settlement1" }],
    });
    const context = makeContext(input);

    phaseEvents(context);

    const key = "settlement1:food";
    const finalQty = context.shared.pendingStockpiles.get(key) ?? 0;
    expect(finalQty).toBe(70);
  });

  it("clamps at zero when drain exceeds quantity", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            amount: 150,
            resourceId: "food",
            settlementId: "settlement1",
          },
          effectType: "resource_drain",
        }),
      ],
      stockpiles: [{ cap: 500, quantity: 100, resourceId: "food", settlementId: "settlement1" }],
    });
    const context = makeContext(input);

    phaseEvents(context);

    const key = "settlement1:food";
    const finalQty = context.shared.pendingStockpiles.get(key) ?? 0;
    expect(finalQty).toBe(0);
  });

  it("logs resource_drain event", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            amount: 30,
            resourceId: "food",
            settlementId: "settlement1",
          },
          effectType: "resource_drain",
          id: "drain123",
        }),
      ],
      stockpiles: [{ cap: 500, quantity: 100, resourceId: "food", settlementId: "settlement1" }],
    });
    const context = makeContext(input);

    const result = phaseEvents(context);

    expect(result.logs).toContainEqual(
      expect.objectContaining({
        category: "event.resource_drain",
        payload: expect.objectContaining({
          amount: 30,
          eventId: "drain123",
          resourceId: "food",
          settlementId: "settlement1",
        }),
      }),
    );
  });
});

describe("phaseEvents — production_multiplier", () => {
  it("stores job-scoped production multiplier in shared state", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            jobId: "job1",
            multiplier: 1.5,
            settlementId: "settlement1",
          },
          effectType: "production_multiplier",
        }),
      ],
    });
    const context = makeContext(input);

    phaseEvents(context);

    const mults = context.shared.pendingEventMultipliers.get("settlement1");
    expect(mults).toBeDefined();
    expect(mults?.productionByJobId.get("job1")).toBe(1.5);
  });

  it("stores building-scoped production multiplier in shared state", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            buildingBlueprintId: "bp1",
            multiplier: 2.0,
            settlementId: "settlement1",
          },
          effectType: "production_multiplier",
        }),
      ],
    });
    const context = makeContext(input);

    phaseEvents(context);

    const mults = context.shared.pendingEventMultipliers.get("settlement1");
    expect(mults).toBeDefined();
    expect(mults?.productionByBuildingId.get("bp1")).toBe(2.0);
  });

  it("composes multipliers when multiple events overlap", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            jobId: "job1",
            multiplier: 2.0,
            settlementId: "settlement1",
          },
          effectType: "production_multiplier",
          id: "evt1",
        }),
        makeEvent({
          effectPayloadJsonb: {
            jobId: "job1",
            multiplier: 1.5,
            settlementId: "settlement1",
          },
          effectType: "production_multiplier",
          id: "evt2",
        }),
      ],
    });
    const context = makeContext(input);

    phaseEvents(context);

    const mults = context.shared.pendingEventMultipliers.get("settlement1");
    expect(mults?.productionByJobId.get("job1")).toBe(3.0); // 2.0 * 1.5
  });
});

describe("phaseEvents — consumption_multiplier", () => {
  it("stores consumption multiplier in shared state", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            multiplier: 0.8,
            settlementId: "settlement1",
          },
          effectType: "consumption_multiplier",
        }),
      ],
    });
    const context = makeContext(input);

    phaseEvents(context);

    const mults = context.shared.pendingEventMultipliers.get("settlement1");
    expect(mults?.consumption).toBe(0.8);
  });

  it("composes consumption multipliers", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            multiplier: 2.0,
            settlementId: "settlement1",
          },
          effectType: "consumption_multiplier",
          id: "evt1",
        }),
        makeEvent({
          effectPayloadJsonb: {
            multiplier: 0.5,
            settlementId: "settlement1",
          },
          effectType: "consumption_multiplier",
          id: "evt2",
        }),
      ],
    });
    const context = makeContext(input);

    phaseEvents(context);

    const mults = context.shared.pendingEventMultipliers.get("settlement1");
    expect(mults?.consumption).toBe(1.0); // 2.0 * 0.5
  });
});

describe("phaseEvents — upkeep_multiplier", () => {
  it("stores upkeep multiplier in shared state", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            multiplier: 1.2,
            settlementId: "settlement1",
          },
          effectType: "upkeep_multiplier",
        }),
      ],
    });
    const context = makeContext(input);

    phaseEvents(context);

    const mults = context.shared.pendingEventMultipliers.get("settlement1");
    expect(mults?.upkeep).toBe(1.2);
  });
});

describe("phaseEvents — population_loss", () => {
  it("logs population_loss event", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            amount: 10,
            settlementId: "settlement1",
          },
          effectType: "population_loss",
          id: "loss123",
        }),
      ],
    });
    const context = makeContext(input);

    const result = phaseEvents(context);

    expect(result.logs).toContainEqual(
      expect.objectContaining({
        category: "event.population_loss",
        payload: expect.objectContaining({
          amount: 10,
          eventId: "loss123",
          settlementId: "settlement1",
        }),
      }),
    );
  });
});

describe("phaseEvents — population_boost", () => {
  it("logs population_boost event", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            amount: 5,
            settlementId: "settlement1",
          },
          effectType: "population_boost",
          id: "boost123",
        }),
      ],
    });
    const context = makeContext(input);

    const result = phaseEvents(context);

    expect(result.logs).toContainEqual(
      expect.objectContaining({
        category: "event.population_boost",
        payload: expect.objectContaining({
          amount: 5,
          eventId: "boost123",
          settlementId: "settlement1",
        }),
      }),
    );
  });
});

describe("phaseEvents — managed_population_change", () => {
  it("tracks managed population delta in shared state", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            delta: 5,
            managedPopulationId: "mp1",
          },
          effectType: "managed_population_change",
        }),
      ],
    });
    const context = makeContext(input);

    phaseEvents(context);

    expect(context.shared.pendingManagedPopulationDeltas.get("mp1")).toBe(5);
  });

  it("accumulates managed population deltas", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {
            delta: 5,
            managedPopulationId: "mp1",
          },
          effectType: "managed_population_change",
          id: "evt1",
        }),
        makeEvent({
          effectPayloadJsonb: {
            delta: -2,
            managedPopulationId: "mp1",
          },
          effectType: "managed_population_change",
          id: "evt2",
        }),
      ],
    });
    const context = makeContext(input);

    phaseEvents(context);

    expect(context.shared.pendingManagedPopulationDeltas.get("mp1")).toBe(3);
  });
});

describe("phaseEvents — deposit_discovered", () => {
  it("logs deposit_discovered event", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {},
          effectType: "deposit_discovered",
          id: "disc123",
        }),
      ],
    });
    const context = makeContext(input);

    const result = phaseEvents(context);

    expect(result.logs).toContainEqual(
      expect.objectContaining({
        category: "event.deposit_discovered",
        payload: expect.objectContaining({
          eventId: "disc123",
        }),
      }),
    );
  });
});

describe("phaseEvents — event status filtering", () => {
  it("ignores pending events until activation turn", () => {
    const input = makeInput({
      events: [
        makeEvent({
          activateOnTransitionAfterTurnNumber: 10,
          effectPayloadJsonb: { amount: 100, resourceId: "food", settlementId: "settlement1" },
          effectType: "resource_grant",
        }),
      ],
      stockpiles: [{ cap: 500, quantity: 50, resourceId: "food", settlementId: "settlement1" }],
      turnNumber: 5,
    });
    const context = makeContext(input);

    phaseEvents(context);

    const key = "settlement1:food";
    // Should remain at initial value if event wasn't processed
    expect(context.shared.pendingStockpiles.get(key)).toBe(50);
  });

  it("processes events on or after activation turn", () => {
    const input = makeInput({
      events: [
        makeEvent({
          activateOnTransitionAfterTurnNumber: 5,
          effectPayloadJsonb: { amount: 100, resourceId: "food", settlementId: "settlement1" },
          effectType: "resource_grant",
        }),
      ],
      stockpiles: [{ cap: 500, quantity: 0, resourceId: "food", settlementId: "settlement1" }],
      turnNumber: 5,
    });
    const context = makeContext(input);

    phaseEvents(context);

    const key = "settlement1:food";
    expect(context.shared.pendingStockpiles.get(key)).toBe(100);
  });

  it("ignores expired events", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: { amount: 100, resourceId: "food", settlementId: "settlement1" },
          effectType: "resource_grant",
          status: "expired",
        }),
      ],
      stockpiles: [{ cap: 500, quantity: 50, resourceId: "food", settlementId: "settlement1" }],
    });
    const context = makeContext(input);

    phaseEvents(context);

    const key = "settlement1:food";
    // Should remain at initial value if event wasn't processed
    expect(context.shared.pendingStockpiles.get(key)).toBe(50);
  });
});

describe("phaseEvents — scope-based resource effects", () => {
  // Two nations, two settlements per nation — exercises world/nation/settlement scope.
  const MULTI_SETTLEMENTS = [
    { id: "s1", name: "North Keep", nationId: "n1" },
    { id: "s2", name: "South Fort", nationId: "n1" },
    { id: "s3", name: "East Hold", nationId: "n2" },
    { id: "s4", name: "West Post", nationId: "n2" },
  ];

  const GRAIN_STOCKPILES = MULTI_SETTLEMENTS.map((s) => ({
    cap: 1000,
    quantity: 100,
    resourceId: "food",
    settlementId: s.id,
  }));

  it("settlement scope: resource_drain only affects the scoped settlement", () => {
    const input = makeInput({
      settlements: MULTI_SETTLEMENTS,
      stockpiles: GRAIN_STOCKPILES,
      events: [
        makeEvent({
          effectType: "resource_drain",
          scopeType: "settlement",
          scopeSettlementId: "s2",
          effectPayloadJsonb: { resourceId: "food", amount: 40 },
        }),
      ],
    });
    const context = makeContext(input);
    phaseEvents(context);

    // s2 drained by 40; all others unchanged at 100
    expect(context.shared.pendingStockpiles.get("s1:food")).toBe(100);
    expect(context.shared.pendingStockpiles.get("s2:food")).toBe(60);
    expect(context.shared.pendingStockpiles.get("s3:food")).toBe(100);
    expect(context.shared.pendingStockpiles.get("s4:food")).toBe(100);
  });

  it("nation scope: resource_grant affects all settlements in the nation", () => {
    const input = makeInput({
      settlements: MULTI_SETTLEMENTS,
      stockpiles: GRAIN_STOCKPILES,
      events: [
        makeEvent({
          effectType: "resource_grant",
          scopeType: "nation",
          scopeNationId: "n2",
          effectPayloadJsonb: { resourceId: "food", amount: 50 },
        }),
      ],
    });
    const context = makeContext(input);
    phaseEvents(context);

    // nation n2 settlements (s3, s4) each gain 50; n1 settlements (s1, s2) unchanged
    expect(context.shared.pendingStockpiles.get("s1:food")).toBe(100);
    expect(context.shared.pendingStockpiles.get("s2:food")).toBe(100);
    expect(context.shared.pendingStockpiles.get("s3:food")).toBe(150);
    expect(context.shared.pendingStockpiles.get("s4:food")).toBe(150);
  });

  it("world scope: resource_drain affects all settlements", () => {
    const input = makeInput({
      settlements: MULTI_SETTLEMENTS,
      stockpiles: GRAIN_STOCKPILES,
      events: [
        makeEvent({
          effectType: "resource_drain",
          scopeType: "world",
          effectPayloadJsonb: { resourceId: "food", amount: 25 },
        }),
      ],
    });
    const context = makeContext(input);
    phaseEvents(context);

    expect(context.shared.pendingStockpiles.get("s1:food")).toBe(75);
    expect(context.shared.pendingStockpiles.get("s2:food")).toBe(75);
    expect(context.shared.pendingStockpiles.get("s3:food")).toBe(75);
    expect(context.shared.pendingStockpiles.get("s4:food")).toBe(75);
  });

  it("settlement scope: production_multiplier only registers for scoped settlement", () => {
    const input = makeInput({
      settlements: MULTI_SETTLEMENTS,
      stockpiles: GRAIN_STOCKPILES,
      events: [
        makeEvent({
          effectType: "production_multiplier",
          scopeType: "settlement",
          scopeSettlementId: "s1",
          effectPayloadJsonb: { jobId: "farming", multiplier: 2.0 },
        }),
      ],
    });
    const context = makeContext(input);
    phaseEvents(context);

    const s1Mults = context.shared.pendingEventMultipliers.get("s1");
    expect(s1Mults?.productionByJobId.get("farming")).toBe(2.0);

    // Other settlements must have no registered multiplier
    expect(context.shared.pendingEventMultipliers.get("s2")).toBeUndefined();
    expect(context.shared.pendingEventMultipliers.get("s3")).toBeUndefined();
    expect(context.shared.pendingEventMultipliers.get("s4")).toBeUndefined();
  });
});

describe("phaseEvents — determinism", () => {
  it("produces same output given same input and seed", () => {
    const events = [
      makeEvent({
        effectPayloadJsonb: { amount: 50, resourceId: "food", settlementId: "settlement1" },
        effectType: "resource_grant",
        id: "evt1",
      }),
      makeEvent({
        effectPayloadJsonb: { amount: 30, resourceId: "water", settlementId: "settlement1" },
        effectType: "resource_grant",
        id: "evt2",
      }),
    ];

    const input1 = makeInput({
      events,
      stockpiles: [
        { cap: 500, quantity: 0, resourceId: "food", settlementId: "settlement1" },
        { cap: 500, quantity: 0, resourceId: "water", settlementId: "settlement1" },
      ],
    });
    const context1 = makeContext(input1);

    const input2 = makeInput({
      events,
      stockpiles: [
        { cap: 500, quantity: 0, resourceId: "food", settlementId: "settlement1" },
        { cap: 500, quantity: 0, resourceId: "water", settlementId: "settlement1" },
      ],
    });
    const context2 = makeContext(input2);

    phaseEvents(context1);
    phaseEvents(context2);

    expect(context1.shared.pendingStockpiles.get("settlement1:food")).toBe(
      context2.shared.pendingStockpiles.get("settlement1:food"),
    );
    expect(context1.shared.pendingStockpiles.get("settlement1:water")).toBe(
      context2.shared.pendingStockpiles.get("settlement1:water"),
    );
  });
});

describe("phaseEvents — building_destroyed via effect.settlementBuildingId", () => {
  it("queues building state change when settlementBuildingId is on the effect", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectType: "building_destroyed",
          effects: [
            makeEffect({
              effectType: "building_destroyed",
              settlementBuildingId: "building-abc",
            }),
          ],
          id: "evt-destroy",
        }),
      ],
    });
    const context = makeContext(input);

    const result = phaseEvents(context);

    expect(result.buildingStateChanges).toContainEqual(
      expect.objectContaining({
        settlementBuildingId: "building-abc",
        toState: "auto_deconstructed",
      }),
    );
  });

  it("logs event.building_destroyed", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectType: "building_destroyed",
          effects: [
            makeEffect({
              effectType: "building_destroyed",
              settlementBuildingId: "building-abc",
            }),
          ],
          id: "evt-destroy",
        }),
      ],
    });
    const context = makeContext(input);

    const result = phaseEvents(context);

    expect(result.logs).toContainEqual(
      expect.objectContaining({
        category: "event.building_destroyed",
        payload: expect.objectContaining({
          eventId: "evt-destroy",
          settlementBuildingId: "building-abc",
        }),
      }),
    );
  });

  it("does not queue state change when settlementBuildingId is null", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectPayloadJsonb: {},
          effectType: "building_destroyed",
          effects: [
            makeEffect({
              effectType: "building_destroyed",
              settlementBuildingId: null,
            }),
          ],
        }),
      ],
    });
    const context = makeContext(input);

    const result = phaseEvents(context);

    expect(result.buildingStateChanges).toHaveLength(0);
  });
});

describe("phaseEvents — upkeep_multiplier blueprint targeting via extraDataJsonb", () => {
  it("applies multiplier to specific blueprints when building_blueprint_mode is select", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectType: "upkeep_multiplier",
          effects: [
            makeEffect({
              effectType: "upkeep_multiplier",
              extraDataJsonb: {
                building_blueprint_ids: ["bp-1", "bp-2"],
                building_blueprint_mode: "select",
              },
              multiplierValue: 1.5,
            }),
          ],
        }),
      ],
    });
    const context = makeContext(input);

    phaseEvents(context);

    const mults = context.shared.pendingEventMultipliers.get("settlement1");
    expect(mults?.upkeepByBlueprintId.get("bp-1")).toBe(1.5);
    expect(mults?.upkeepByBlueprintId.get("bp-2")).toBe(1.5);
    // Global upkeep multiplier should remain at default
    expect(mults?.upkeep).toBe(1);
  });

  it("applies multiplier to all buildings when extraDataJsonb is absent", () => {
    const input = makeInput({
      events: [
        makeEvent({
          effectType: "upkeep_multiplier",
          effects: [
            makeEffect({
              effectType: "upkeep_multiplier",
              multiplierValue: 2.0,
            }),
          ],
        }),
      ],
    });
    const context = makeContext(input);

    phaseEvents(context);

    const mults = context.shared.pendingEventMultipliers.get("settlement1");
    expect(mults?.upkeep).toBe(2.0);
    expect(mults?.upkeepByBlueprintId.size).toBe(0);
  });
});
