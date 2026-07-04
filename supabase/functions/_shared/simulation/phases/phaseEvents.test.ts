// Unit tests for phaseEvents — event lifecycle/status transitions, effect
// application gaps not already covered by ../eventEffects.test.ts (which
// exercises most effect-type arithmetic directly through phaseEvents), and
// log/notification wiring that phaseEvents itself is responsible for.
//
// See ../eventEffects.test.ts for exhaustive coverage of resource_grant,
// resource_drain, production_multiplier, consumption_multiplier,
// upkeep_multiplier (incl. blueprint targeting), population_boost,
// managed_population_change, deposit_discovered, building_destroyed (via
// effects array), activation-turn gating, and world/nation/settlement scope
// fan-out for resource + production effects. Tests here focus on: event
// status-transition state machine, deposit_destroyed (untested elsewhere),
// legacy top-level effectType/effectPayloadJsonb backward compat for
// building_destroyed, population_loss interaction with pre-existing
// pendingDeaths and nation-scope fan-out, and the notifications contract.
//
// Cross-runtime module: Deno-compatible, no browser APIs.

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { describe, expect, it } from "vitest";

import { phaseEvents } from "./phaseEvents.ts";
import { makeCitizen, makeInputState, makeSettlement, makeSharedState } from "./testFixtures.ts";

import type {
  SimEffect,
  SimEvent,
  SimulationContext,
  SimulationInputState,
  SimulationSharedState,
} from "../simulationTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<SimEvent> = {}): SimEvent {
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

function makeEffect(overrides: Partial<SimEffect> = {}): SimEffect {
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

function makeContextWith(
  inputOverrides: Partial<SimulationInputState>,
  sharedOverrides: Partial<SimulationSharedState> = {},
): SimulationContext {
  return {
    input: makeInputState(inputOverrides),
    shared: { ...makeSharedState(), ...sharedOverrides },
  };
}

// ---------------------------------------------------------------------------
// Event lifecycle / status transitions
// ---------------------------------------------------------------------------

describe("phaseEvents — event status transitions", () => {
  it("transitions a pending instant event straight to expired with null remainingTransitions", () => {
    const context = makeContextWith({
      events: [makeEvent({ durationType: "instant", id: "e1", status: "pending" })],
    });

    const { eventStatusPatches } = phaseEvents(context);

    expect(eventStatusPatches).toEqual([
      { eventId: "e1", fromStatus: "pending", remainingTransitions: null, toStatus: "expired" },
    ]);
  });

  it("transitions a pending sustained event with remainingTransitions > 1 to active and decrements the count", () => {
    const context = makeContextWith({
      events: [
        makeEvent({
          durationType: "sustained",
          id: "e2",
          remainingTransitions: 3,
          status: "pending",
        }),
      ],
    });

    const { eventStatusPatches } = phaseEvents(context);

    expect(eventStatusPatches).toEqual([
      { eventId: "e2", fromStatus: "pending", remainingTransitions: 2, toStatus: "active" },
    ]);
  });

  it("expires a pending sustained event when remainingTransitions is 1", () => {
    const context = makeContextWith({
      events: [
        makeEvent({
          durationType: "sustained",
          id: "e3",
          remainingTransitions: 1,
          status: "pending",
        }),
      ],
    });

    const { eventStatusPatches } = phaseEvents(context);

    expect(eventStatusPatches).toEqual([
      { eventId: "e3", fromStatus: "pending", remainingTransitions: 0, toStatus: "expired" },
    ]);
  });

  it("defaults a pending sustained event with null remainingTransitions to a single turn (expires)", () => {
    const context = makeContextWith({
      events: [
        makeEvent({
          durationType: "sustained",
          id: "e4",
          remainingTransitions: null,
          status: "pending",
        }),
      ],
    });

    const { eventStatusPatches } = phaseEvents(context);

    expect(eventStatusPatches).toEqual([
      { eventId: "e4", fromStatus: "pending", remainingTransitions: 0, toStatus: "expired" },
    ]);
  });

  it("keeps an already-active sustained event active while counting down remainingTransitions", () => {
    const context = makeContextWith({
      events: [
        makeEvent({
          durationType: "sustained",
          id: "e5",
          remainingTransitions: 2,
          status: "active",
        }),
      ],
    });

    const { eventStatusPatches } = phaseEvents(context);

    expect(eventStatusPatches).toEqual([
      { eventId: "e5", fromStatus: "active", remainingTransitions: 1, toStatus: "active" },
    ]);
  });

  it("expires an already-active sustained event once remainingTransitions reaches 1", () => {
    const context = makeContextWith({
      events: [
        makeEvent({
          durationType: "sustained",
          id: "e6",
          remainingTransitions: 1,
          status: "active",
        }),
      ],
    });

    const { eventStatusPatches } = phaseEvents(context);

    expect(eventStatusPatches).toEqual([
      { eventId: "e6", fromStatus: "active", remainingTransitions: 0, toStatus: "expired" },
    ]);
  });

  it("skips resolved and expired events entirely, emitting no status patch", () => {
    const context = makeContextWith({
      events: [
        makeEvent({ id: "resolved1", status: "resolved" }),
        makeEvent({ id: "expired1", status: "expired" }),
        makeEvent({ durationType: "instant", id: "active1", status: "active" }),
      ],
    });

    const { eventStatusPatches } = phaseEvents(context);

    expect(eventStatusPatches).toHaveLength(1);
    expect(eventStatusPatches[0]?.eventId).toBe("active1");
  });

  it("does not emit a status patch (or apply effects) for a pending event gated by activation turn", () => {
    const context = makeContextWith({
      events: [
        makeEvent({
          activateOnTransitionAfterTurnNumber: 10,
          effectPayloadJsonb: { amount: 100, resourceId: "food", settlementId: "s1" },
          effectType: "resource_grant",
          id: "gated1",
          status: "pending",
        }),
      ],
      turnNumber: 5,
    });

    const { eventStatusPatches, logs } = phaseEvents(context);

    expect(eventStatusPatches).toHaveLength(0);
    expect(logs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// deposit_destroyed — untested in ../eventEffects.test.ts
// ---------------------------------------------------------------------------

describe("phaseEvents — deposit_destroyed", () => {
  it("queues a removal update via legacy top-level effectPayloadJsonb", () => {
    const context = makeContextWith({
      events: [
        makeEvent({
          effectPayloadJsonb: { depositInstanceId: "dep1" },
          effectType: "deposit_destroyed",
          id: "evt-dep",
        }),
      ],
    });

    const result = phaseEvents(context);

    expect(result.depositUpdates).toEqual([
      { depositInstanceId: "dep1", resourceDeltas: [], toStatus: "removed" },
    ]);
    expect(result.logs).toContainEqual(
      expect.objectContaining({
        category: "event.deposit_destroyed",
        payload: expect.objectContaining({ depositInstanceId: "dep1", eventId: "evt-dep" }),
      }),
    );
  });

  it("prefers effect.depositInstanceId over the legacy payload field", () => {
    const context = makeContextWith({
      events: [
        makeEvent({
          effectPayloadJsonb: { depositInstanceId: "ignored" },
          effectType: "deposit_destroyed",
          effects: [makeEffect({ depositInstanceId: "dep-from-effect", effectType: "deposit_destroyed" })],
          id: "evt-dep2",
        }),
      ],
    });

    const result = phaseEvents(context);

    expect(result.depositUpdates).toEqual([
      { depositInstanceId: "dep-from-effect", resourceDeltas: [], toStatus: "removed" },
    ]);
  });

  it("dedupes repeated destroys of the same deposit across multiple events", () => {
    const context = makeContextWith({
      events: [
        makeEvent({
          effectPayloadJsonb: { depositInstanceId: "dep-shared" },
          effectType: "deposit_destroyed",
          id: "evt-a",
        }),
        makeEvent({
          effectPayloadJsonb: { depositInstanceId: "dep-shared" },
          effectType: "deposit_destroyed",
          id: "evt-b",
        }),
      ],
    });

    const result = phaseEvents(context);

    expect(result.depositUpdates).toHaveLength(1);
    expect(result.depositUpdates[0]?.depositInstanceId).toBe("dep-shared");
  });
});

// ---------------------------------------------------------------------------
// building_destroyed — legacy top-level effectType/effectPayloadJsonb path
// (../eventEffects.test.ts only covers the new-style effects array).
// ---------------------------------------------------------------------------

describe("phaseEvents — building_destroyed via legacy effectPayloadJsonb", () => {
  it("queues a building state change from the legacy payload field", () => {
    const context = makeContextWith({
      events: [
        makeEvent({
          effectPayloadJsonb: { settlementBuildingId: "b1" },
          effectType: "building_destroyed",
          id: "evt-b1",
        }),
      ],
    });

    const result = phaseEvents(context);

    expect(result.buildingStateChanges).toEqual([
      { missedUpkeepCountDelta: null, settlementBuildingId: "b1", toState: "auto_deconstructed" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// population_loss — interaction with pre-existing pendingDeaths and
// nation-scope fan-out (not covered by ../eventEffects.test.ts, which only
// exercises settlement scope for population_loss).
// ---------------------------------------------------------------------------

describe("phaseEvents — population_loss interaction with pendingDeaths", () => {
  it("excludes citizens already marked dead earlier this turn from selection and count", () => {
    const s1 = makeSettlement({ id: "s1" });
    const c1 = makeCitizen({ id: "c1", settlementId: "s1" });
    const c2 = makeCitizen({ id: "c2", settlementId: "s1" });

    const context = makeContextWith(
      {
        citizens: [c1, c2],
        events: [
          makeEvent({
            effectPayloadJsonb: { amount: 5, settlementId: "s1" },
            effectType: "population_loss",
            id: "loss1",
          }),
        ],
        settlements: [s1],
      },
      { pendingDeaths: new Set(["c1"]) },
    );

    const result = phaseEvents(context);

    expect(result.citizenDeaths).toEqual([{ category: "event", citizenId: "c2", detail: "population_loss event" }]);
  });

  it("excludes citizens with status dead from selection", () => {
    const s1 = makeSettlement({ id: "s1" });
    const c1 = makeCitizen({ id: "c1", settlementId: "s1", status: "dead" });
    const c2 = makeCitizen({ id: "c2", settlementId: "s1" });

    const context = makeContextWith({
      citizens: [c1, c2],
      events: [
        makeEvent({
          effectPayloadJsonb: { amount: 5, settlementId: "s1" },
          effectType: "population_loss",
          id: "loss2",
        }),
      ],
      settlements: [s1],
    });

    const result = phaseEvents(context);

    expect(result.citizenDeaths).toEqual([{ category: "event", citizenId: "c2", detail: "population_loss event" }]);
  });

  it("fans population_loss out per settlement under nation scope, killing independently in each", () => {
    const s1 = makeSettlement({ id: "s1", nationId: "n1" });
    const s2 = makeSettlement({ id: "s2", nationId: "n1" });
    const c1 = makeCitizen({ id: "c1", settlementId: "s1" });
    const c2 = makeCitizen({ id: "c2", settlementId: "s2" });

    const context = makeContextWith({
      citizens: [c1, c2],
      events: [
        makeEvent({
          effectPayloadJsonb: { amount: 1 },
          effectType: "population_loss",
          id: "loss-nation",
          scopeNationId: "n1",
          scopeType: "nation",
        }),
      ],
      settlements: [s1, s2],
    });

    const result = phaseEvents(context);

    expect(result.citizenDeaths).toHaveLength(2);
    expect(result.citizenDeaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ citizenId: "c1" }),
        expect.objectContaining({ citizenId: "c2" }),
      ]),
    );
  });

  it("does not fan population_loss out to settlements outside the scoped nation", () => {
    const s1 = makeSettlement({ id: "s1", nationId: "n1" });
    const s2 = makeSettlement({ id: "s2", nationId: "n2" });
    const c1 = makeCitizen({ id: "c1", settlementId: "s1" });
    const c2 = makeCitizen({ id: "c2", settlementId: "s2" });

    const context = makeContextWith({
      citizens: [c1, c2],
      events: [
        makeEvent({
          effectPayloadJsonb: { amount: 1 },
          effectType: "population_loss",
          id: "loss-nation2",
          scopeNationId: "n1",
          scopeType: "nation",
        }),
      ],
      settlements: [s1, s2],
    });

    const result = phaseEvents(context);

    expect(result.citizenDeaths).toEqual([{ category: "event", citizenId: "c1", detail: "population_loss event" }]);
  });
});

// ---------------------------------------------------------------------------
// Notifications contract
// ---------------------------------------------------------------------------

describe("phaseEvents — notifications", () => {
  it("emits no notifications regardless of effects applied (current no-op contract)", () => {
    const context = makeContextWith({
      events: [
        makeEvent({
          effectPayloadJsonb: { amount: 10, resourceId: "food", settlementId: "s1" },
          effectType: "resource_grant",
          id: "evt1",
        }),
        makeEvent({
          effectPayloadJsonb: { settlementBuildingId: "b1" },
          effectType: "building_destroyed",
          id: "evt2",
        }),
      ],
    });

    const result = phaseEvents(context);

    expect(result.notifications).toEqual([]);
  });
});
