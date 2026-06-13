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
    scopeType: "world",
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
    settlements: [
      { id: "s1", name: "Settlement One" },
      { id: "s2", name: "Settlement Two", nationId: "n1" },
      { id: "s3", name: "Settlement Three", nationId: "n1" },
    ],
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
    it("returns empty logs, patches, and notifications when events list is empty", () => {
      const ctx = makeContext({ events: [] });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(0);
      expect(result.eventStatusPatches).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
    });
  });

  describe("activation lifecycle: pending → active → expired", () => {
    it("transitions pending event to active on first eligible turn", () => {
      const eventId = nextId();
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            id: eventId,
            status: "pending",
            activateOnTransitionAfterTurnNumber: 5,
            effectPayloadJsonb: { resourceId: "r1", amount: 100 },
          }),
        ],
        turnNumber: 5,
      });

      const result = phaseEvents(ctx);

      // Should generate a log for the effect
      expect(result.logs).toContainEqual(
        expect.objectContaining({
          category: "event.resource_grant",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion
          payload: expect.objectContaining({ eventId } as Record<
            string,
            unknown
          >),
        }),
      );

      // Should generate a status patch: pending → active
      expect(result.eventStatusPatches).toContainEqual(
        expect.objectContaining({
          eventId,
          toStatus: "active",
        }),
      );
    });

    it("transitions active event to expired when remaining_transitions reaches 0", () => {
      const eventId = nextId();
      const ctx = makeContext({
        events: [
          makeEvent("population_loss", {
            id: eventId,
            status: "active",
            remainingTransitions: 1,
            effectPayloadJsonb: { amount: 10 },
          }),
        ],
        turnNumber: 5,
      });

      const result = phaseEvents(ctx);

      // Should generate a log for the effect
      expect(result.logs.length).toBeGreaterThan(0);

      // Should generate a status patch: active → expired
      expect(result.eventStatusPatches).toContainEqual(
        expect.objectContaining({
          eventId,
          toStatus: "expired",
          remainingTransitions: undefined,
        }),
      );
    });

    it("keeps active event with remaining transitions > 1 as active without status patch", () => {
      const eventId = nextId();
      const ctx = makeContext({
        events: [
          makeEvent("population_boost", {
            id: eventId,
            status: "active",
            remainingTransitions: 3,
            effectPayloadJsonb: { amount: 5 },
          }),
        ],
        turnNumber: 5,
      });

      const result = phaseEvents(ctx);

      // Should generate a log
      expect(result.logs.length).toBeGreaterThan(0);

      // Should NOT generate a status patch (status stays active, only remaining_transitions changes)
      expect(result.eventStatusPatches).toHaveLength(0);
    });

    it("does not process expired events", () => {
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            status: "expired",
            effectPayloadJsonb: { resourceId: "r1", amount: 100 },
          }),
        ],
      });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(0);
      expect(result.eventStatusPatches).toHaveLength(0);
    });

    it("does not process resolved events", () => {
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            status: "resolved",
            effectPayloadJsonb: { resourceId: "r1", amount: 100 },
          }),
        ],
      });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(0);
      expect(result.eventStatusPatches).toHaveLength(0);
    });
  });

  describe("cancellation: cancelled events never apply", () => {
    it("skips cancelled events entirely", () => {
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            status: "cancelled",
            effectPayloadJsonb: { resourceId: "r1", amount: 100 },
          }),
        ],
      });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(0);
      expect(result.eventStatusPatches).toHaveLength(0);
    });
  });

  describe("turn number filtering", () => {
    it("skips events whose activate_on_transition_after_turn_number is in the future", () => {
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            activateOnTransitionAfterTurnNumber: 10,
            effectPayloadJsonb: { resourceId: "r1", amount: 100 },
          }),
        ],
        turnNumber: 5,
      });

      const result = phaseEvents(ctx);

      expect(result.logs).toHaveLength(0);
      expect(result.eventStatusPatches).toHaveLength(0);
    });

    it("processes events whose activate turn equals the current turn", () => {
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            activateOnTransitionAfterTurnNumber: 5,
            effectPayloadJsonb: { resourceId: "r1", amount: 100 },
          }),
        ],
        turnNumber: 5,
      });

      const result = phaseEvents(ctx);

      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.eventStatusPatches.length).toBeGreaterThan(0);
    });

    it("processes events whose activate turn is before the current turn", () => {
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            activateOnTransitionAfterTurnNumber: 1,
            effectPayloadJsonb: { resourceId: "r1", amount: 100 },
          }),
        ],
        turnNumber: 5,
      });

      const result = phaseEvents(ctx);

      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.eventStatusPatches.length).toBeGreaterThan(0);
    });
  });

  describe("scope resolution", () => {
    it("resolves world scope to all settlements", () => {
      const eventId = nextId();
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            id: eventId,
            scopeType: "world",
            effectPayloadJsonb: { resourceId: "r1", amount: 100 },
          }),
        ],
      });

      const result = phaseEvents(ctx);

      // Should generate logs for all three settlements
      const logsForEvent = result.logs.filter(
        (l) => l.payload.eventId === eventId,
      );
      expect(logsForEvent).toHaveLength(3);
      const settlementIds = logsForEvent.map((l) =>
        String(l.payload.settlementId),
      );
      expect(new Set(settlementIds)).toEqual(new Set(["s1", "s2", "s3"]));
    });

    it("resolves nation scope to settlements of that nation", () => {
      const eventId = nextId();
      const ctx = makeContext({
        events: [
          makeEvent("population_loss", {
            id: eventId,
            scopeType: "nation",
            scopeNationId: "n1",
            effectPayloadJsonb: { amount: 10 },
          }),
        ],
      });

      const result = phaseEvents(ctx);

      // Should generate logs for s2 and s3 only (nation n1)
      const logsForEvent = result.logs.filter(
        (l) => l.payload.eventId === eventId,
      );
      expect(logsForEvent).toHaveLength(2);
      const settlementIds = logsForEvent.map((l) =>
        String(l.payload.settlementId),
      );
      expect(new Set(settlementIds)).toEqual(new Set(["s2", "s3"]));
    });

    it("resolves settlement scope to single settlement", () => {
      const eventId = nextId();
      const ctx = makeContext({
        events: [
          makeEvent("population_boost", {
            id: eventId,
            scopeType: "settlement",
            scopeSettlementId: "s2",
            effectPayloadJsonb: { amount: 5 },
          }),
        ],
      });

      const result = phaseEvents(ctx);

      // Should generate log for s2 only
      const logsForEvent = result.logs.filter(
        (l) => l.payload.eventId === eventId,
      );
      expect(logsForEvent).toHaveLength(1);
      expect(logsForEvent[0]?.payload.settlementId).toBe("s2");
    });
  });

  describe("turn log entries", () => {
    it("includes event id and group id in log payload", () => {
      const eventId = nextId();
      const groupId = nextId();
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            id: eventId,
            groupId,
            effectPayloadJsonb: { resourceId: "r1", amount: 100 },
          }),
        ],
      });

      const result = phaseEvents(ctx);

      const logs = result.logs.filter((l) => l.payload.eventId === eventId);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]?.payload.groupId).toBe(groupId);
    });

    it("includes scope in log payload", () => {
      const ctx = makeContext({
        events: [
          makeEvent("population_loss", {
            scopeType: "nation",
            scopeNationId: "n1",
            effectPayloadJsonb: { amount: 10 },
          }),
        ],
      });

      const result = phaseEvents(ctx);

      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs[0]?.payload.scope).toBe("nation");
    });

    it("includes applied delta in log payload for resource effects", () => {
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            scopeType: "settlement",
            scopeSettlementId: "s1",
            effectPayloadJsonb: { resourceId: "r1", amount: 250 },
          }),
        ],
      });

      const result = phaseEvents(ctx);

      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs[0]?.payload.amount).toBe(250);
    });
  });

  describe("effect type coverage", () => {
    const effectTypes: EventEffectType[] = [
      "consumption_multiplier",
      "deposit_discovered",
      "managed_population_change",
      "population_boost",
      "population_loss",
      "production_multiplier",
      "resource_drain",
      "resource_grant",
      "upkeep_multiplier",
    ];

    for (const effectType of effectTypes) {
      it(`generates log for ${effectType}`, () => {
        const managedPopulations =
          effectType === "managed_population_change"
            ? [
                {
                  id: "mp1",
                  managedPopulationTypeId: "mpt1",
                  settlementId: "s1",
                  name: "Test Population",
                  currentCount: 10,
                  configuredCullQuantity: 5,
                  status: "active" as const,
                },
              ]
            : [];

        const ctx = makeContext({
          managedPopulations,
          events: [
            makeEvent(effectType, {
              scopeType: "settlement",
              scopeSettlementId: "s1",
              effectPayloadJsonb:
                effectType === "consumption_multiplier" ||
                effectType === "production_multiplier" ||
                effectType === "upkeep_multiplier"
                  ? { multiplier: 1.5 }
                  : effectType === "deposit_discovered"
                    ? {}
                    : effectType === "managed_population_change"
                      ? { managedPopulationId: "mp1", delta: 5 }
                      : effectType === "population_boost"
                        ? { amount: 10 }
                        : effectType === "population_loss"
                          ? { amount: 5 }
                          : effectType === "resource_drain"
                            ? { resourceId: "r1", amount: 100 }
                            : { resourceId: "r1", amount: 100 },
            }),
          ],
        });

        const result = phaseEvents(ctx);

        expect(result.logs.length).toBeGreaterThan(0);
        expect(result.logs[0]?.category).toMatch(
          new RegExp(`^event.${effectType}$`),
        );
      });
    }
  });

  describe("output shape", () => {
    it("always returns empty notifications array", () => {
      const ctx = makeContext({
        events: [
          makeEvent("resource_grant", {
            effectPayloadJsonb: { resourceId: "r1", amount: 100 },
          }),
        ],
      });

      const result = phaseEvents(ctx);

      expect(result.notifications).toHaveLength(0);
    });
  });
});
