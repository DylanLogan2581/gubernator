import { describe, expect, it } from "vitest";

import { phaseEvents } from "./phaseEvents.ts";

import type {
  EventEffectType,
  SimEvent,
  SimulationContext,
  SimulationInputState,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Test helpers
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
  foodConsumptionPerCitizen: 1,
  homelessnessDecliningRate: 0,
  incestPreventionDepth: 0,
  maximumFertilityAgeTurns: null,
  minimumPartnershipAgeTurns: 0,
  mourningPeriodTurns: 0,
  partnershipSeekChance: 0,
  starvationSeverityMultiplier: 1,
  waterConsumptionPerCitizen: 1,
};

let _idCounter = 0;
function nextId(): string {
  return `id-${++_idCounter}`;
}

function makeEvent(
  effectType: EventEffectType,
  overrides: Partial<SimEvent> = {},
): SimEvent {
  return {
    activateOnTransitionAfterTurnNumber: 1,
    effectPayloadJsonb: {},
    effectType,
    id: nextId(),
    status: "pending",
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<SimulationInputState>,
): SimulationContext {
  const input: SimulationInputState = {
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
    settlementBuildings: [],
    settlements: [{ id: "s1", name: "Settlement One" }],
    stockpiles: [],
    systemResourceIds: { foodId: "food", freshWaterId: "water" },
    tradeRoutes: [],
    turnNumber: 5,
    worldId: "w1",
    ...overrides,
  };
  const pendingStockpiles = new Map<string, number>();
  for (const sp of input.stockpiles) {
    pendingStockpiles.set(`${sp.settlementId}:${sp.resourceId}`, sp.quantity);
  }
  return {
    input,
    shared: {
      pendingDeaths: new Set<string>(),
      pendingPopCapBySettlement: new Map(),
      pendingStockpiles,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("phaseEvents", () => {
  describe("no events", () => {
    it("returns empty logs and notifications when events list is empty", () => {
      const ctx = makeContext({ events: [] });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
    });
  });

  describe("effect_type coverage — one event of each type", () => {
    const effectTypes: EventEffectType[] = [
      "deposit_discovered",
      "population_loss",
      "resource_grant",
    ];

    for (const effectType of effectTypes) {
      it(`emits a single event.skipped summary for ${effectType}`, () => {
        const ctx = makeContext({
          events: [makeEvent(effectType)],
          turnNumber: 5,
        });

        const result = phaseEvents(ctx);

        expect(result.logs).toHaveLength(1);
        expect(result.logs[0]?.category).toBe("event.skipped");
        expect(result.logs[0]?.phase).toBe("events");
        expect(result.logs[0]?.payload.count).toBe(1);
        expect(result.logs[0]?.payload.reason).toBe("epic-7-pending");
      });
    }
  });

  describe("status filtering", () => {
    it("processes pending events", () => {
      const ctx = makeContext({
        events: [makeEvent("resource_grant", { status: "pending" })],
      });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(1);
    });

    it("processes active events", () => {
      const ctx = makeContext({
        events: [makeEvent("resource_grant", { status: "active" })],
      });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(1);
    });

    it("skips resolved events", () => {
      const ctx = makeContext({
        events: [makeEvent("resource_grant", { status: "resolved" })],
      });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(0);
    });

    it("skips expired events", () => {
      const ctx = makeContext({
        events: [makeEvent("resource_grant", { status: "expired" })],
      });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(0);
    });
  });

  describe("turn number filtering", () => {
    it("skips events whose activate_on_transition_after_turn_number is in the future", () => {
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            activateOnTransitionAfterTurnNumber: 10,
          }),
        ],
        turnNumber: 5,
      });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(0);
    });

    it("processes events whose activate turn equals the current turn", () => {
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            activateOnTransitionAfterTurnNumber: 5,
          }),
        ],
        turnNumber: 5,
      });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(1);
    });

    it("processes events whose activate turn is before the current turn", () => {
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            activateOnTransitionAfterTurnNumber: 1,
          }),
        ],
        turnNumber: 5,
      });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(1);
    });
  });

  describe("combined filtering", () => {
    it("emits one summary log covering only eligible events in a mixed list", () => {
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            status: "pending",
            activateOnTransitionAfterTurnNumber: 3,
          }),
          makeEvent("deposit_discovered", {
            status: "resolved",
            activateOnTransitionAfterTurnNumber: 1,
          }),
          makeEvent("population_loss", {
            status: "active",
            activateOnTransitionAfterTurnNumber: 10,
          }),
          makeEvent("resource_grant", {
            status: "active",
            activateOnTransitionAfterTurnNumber: 5,
          }),
        ],
        turnNumber: 5,
      });

      const result = phaseEvents(ctx);

      // Only the first and fourth events are eligible
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]?.category).toBe("event.skipped");
      expect(result.logs[0]?.payload.count).toBe(2);
    });
  });

  describe("output shape", () => {
    it("always returns empty notifications array", () => {
      const ctx = makeContext({
        events: [makeEvent("resource_grant")],
      });

      const result = phaseEvents(ctx);

      expect(result.notifications).toHaveLength(0);
    });

    it("emits one summary log regardless of how many eligible events exist", () => {
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant"),
          makeEvent("deposit_discovered"),
          makeEvent("population_loss"),
        ],
        turnNumber: 5,
      });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]?.payload.count).toBe(3);
    });
  });
});
