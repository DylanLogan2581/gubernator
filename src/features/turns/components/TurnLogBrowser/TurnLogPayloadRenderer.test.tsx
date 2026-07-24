import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TurnLogPayloadRenderer } from "./TurnLogPayloadRenderer";

import type { TurnLogEntityLookup } from "../../hooks/useTurnLogEntityLookup";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
  }: {
    readonly children: ReactNode;
    readonly to: string;
  }) => <a href={to}>{children}</a>,
}));

// Use an unrecognised category to exercise RawJsonFallback (the default branch).
const UNKNOWN_CATEGORY = "unknown.event";
const NON_EMPTY_PAYLOAD = { value: 42 };

const EMPTY_LOOKUP: TurnLogEntityLookup = {
  isLoading: false,
  citizen: () => ({ name: null, href: null }),
  building: () => ({ name: null, href: null, blueprintName: null }),
  jobName: () => null,
  resourceName: () => null,
};

function lookupWith(
  overrides: Partial<TurnLogEntityLookup>,
): TurnLogEntityLookup {
  return { ...EMPTY_LOOKUP, ...overrides };
}

describe("TurnLogPayloadRenderer — RawJsonFallback", () => {
  it("never re-renders the category badge in the summary (no duplicate-badge row)", () => {
    render(
      <TurnLogPayloadRenderer
        logCategory={UNKNOWN_CATEGORY}
        payload={NON_EMPTY_PAYLOAD}
        isAdmin={true}
        lookup={EMPTY_LOOKUP}
        mode="summary"
      />,
    );

    expect(screen.queryByText(UNKNOWN_CATEGORY)).toBeNull();
  });

  it("shows raw JSON in expanded mode for admins with a non-empty payload", () => {
    render(
      <TurnLogPayloadRenderer
        logCategory={UNKNOWN_CATEGORY}
        payload={NON_EMPTY_PAYLOAD}
        isAdmin={true}
        lookup={EMPTY_LOOKUP}
        mode="expanded"
      />,
    );

    expect(screen.getByText(/"value": 42/)).toBeDefined();
  });

  it("hides raw JSON in expanded mode for non-admins", () => {
    render(
      <TurnLogPayloadRenderer
        logCategory={UNKNOWN_CATEGORY}
        payload={NON_EMPTY_PAYLOAD}
        isAdmin={false}
        lookup={EMPTY_LOOKUP}
        mode="expanded"
      />,
    );

    expect(screen.queryByText(/"value": 42/)).toBeNull();
  });
});

describe("TurnLogPayloadRenderer — partnership renderers", () => {
  it("renders linked citizen names instead of raw UUIDs", () => {
    render(
      <TurnLogPayloadRenderer
        logCategory="partnership.formed"
        payload={{ citizenAId: "citizen-a", citizenBId: "citizen-b" }}
        lookup={lookupWith({
          citizen: (id) => ({
            name: id === "citizen-a" ? "Alice" : "Bob",
            href: `/worlds/world-1/citizens/${id}`,
          }),
        })}
      />,
    );

    expect(screen.getByRole("link", { name: "Alice" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Bob" })).toBeDefined();
    expect(screen.queryByText(/citizen-a/)).toBeNull();
    expect(screen.queryByText(/citizen-b/)).toBeNull();
  });

  it("renders the surviving citizen's linked name for partnership.widowed", () => {
    render(
      <TurnLogPayloadRenderer
        logCategory="partnership.widowed"
        payload={{
          partnershipId: "partnership-1",
          survivingCitizenId: "citizen-a",
        }}
        lookup={lookupWith({
          citizen: () => ({
            name: "Alice",
            href: "/worlds/world-1/citizens/citizen-a",
          }),
        })}
      />,
    );

    expect(screen.getByRole("link", { name: "Alice" })).toBeDefined();
    expect(screen.getByText(/widowed/)).toBeDefined();
  });
});

describe("TurnLogPayloadRenderer — building renderers", () => {
  it("expanded mode adds the blueprint and grace period beyond the summary", () => {
    const lookup = lookupWith({
      building: () => ({
        name: "Old Mill",
        href: "/worlds/world-1/nations/nation-1/settlements/settlement-1",
        blueprintName: "Windmill",
      }),
    });
    const payload = {
      blueprintId: "bp-1",
      buildingId: "building-1",
      gracePeriodTurns: 3,
      missedUpkeepCount: 5,
    };

    const { rerender } = render(
      <TurnLogPayloadRenderer
        logCategory="building.auto_deconstructed"
        payload={payload}
        lookup={lookup}
        mode="summary"
      />,
    );

    expect(screen.getByRole("link", { name: "Old Mill" })).toBeDefined();
    expect(screen.queryByText(/Windmill/)).toBeNull();

    rerender(
      <TurnLogPayloadRenderer
        logCategory="building.auto_deconstructed"
        payload={payload}
        lookup={lookup}
        mode="expanded"
      />,
    );

    expect(screen.getByText(/Windmill/)).toBeDefined();
    expect(screen.getByText(/3 turns/)).toBeDefined();
  });
});

describe("TurnLogPayloadRenderer — trade route renderers", () => {
  it("renders the human-readable label for a known pause reason", () => {
    render(
      <TurnLogPayloadRenderer
        logCategory="trade_route.paused"
        payload={{
          destinationSettlementId: "settlement-2",
          pauseReason: "insufficient_trader_origin",
          quantityPerTransition: 10,
          resourceId: "resource-1",
          tradeRouteId: "route-1",
        }}
        lookup={EMPTY_LOOKUP}
      />,
    );

    expect(screen.getByText(/Insufficient traders at origin/)).toBeDefined();
    expect(screen.queryByText(/insufficient_trader_origin/)).toBeNull();
  });

  it("falls back to the raw reason string when unknown", () => {
    render(
      <TurnLogPayloadRenderer
        logCategory="trade_route.paused"
        payload={{
          destinationSettlementId: "settlement-2",
          pauseReason: "some_new_reason",
          quantityPerTransition: 10,
          resourceId: "resource-1",
          tradeRouteId: "route-1",
        }}
        lookup={EMPTY_LOOKUP}
      />,
    );

    expect(screen.getByText(/some_new_reason/)).toBeDefined();
  });

  it("renders the pause reason without a dash for historical logs missing quantity/resource (#1324)", () => {
    render(
      <TurnLogPayloadRenderer
        logCategory="trade_route.paused"
        payload={{
          destinationSettlementId: "settlement-2",
          pauseReason: "insufficient_trader_origin",
          tradeRouteId: "route-1",
        }}
        lookup={EMPTY_LOOKUP}
      />,
    );

    expect(screen.getByText(/Insufficient traders at origin/)).toBeDefined();
    expect(screen.queryByText("—")).toBeNull();
  });
});

// One well-formed sample payload per known category. This drives the
// table-walking test below: every entry in the lookup table must parse its
// sample and render something other than the summary fallback ("—"). Adding a
// new category means adding one table entry in the renderer plus one sample
// here — the test then covers it automatically.
const SAMPLE_PAYLOADS: Readonly<Record<string, unknown>> = {
  "building.auto_deconstructed": {
    blueprintId: "bp-1",
    buildingId: "building-1",
    gracePeriodTurns: 3,
    missedUpkeepCount: 5,
  },
  "building.recovered": { blueprintId: "bp-1", buildingId: "building-1" },
  "building.suspended": {
    blueprintId: "bp-1",
    buildingId: "building-1",
    missedUpkeepCount: 2,
  },
  "citizen.born": { parentACitizenId: "c-a", parentBCitizenId: "c-b" },
  "citizen.consumed_food_water": {
    aliveCount: 10,
    foodConsumed: 8,
    foodRequired: 10,
    foodStock: 2,
    settlementId: "s-1",
    waterConsumed: 8,
    waterRequired: 10,
    waterStock: 2,
  },
  "citizen.died_homeless": { deathDetail: "exposure" },
  "citizen.starved": { deathDetail: "no food" },
  "construction.completed": { projectId: "p-1", workers: 4 },
  "construction.paused": { projectId: "p-1", workers: 0 },
  "construction.progress": {
    costsDeducted: {},
    newProgress: 5,
    projectId: "p-1",
    settlementId: "s-1",
    workers: 3,
    workerTurnsRequired: 10,
  },
  "deposit.depleted": { depositId: "d-1", depositName: "Iron Vein" },
  "deposit.processed": {
    depositId: "d-1",
    extractedByResource: {},
    inputShortfallScale: 1,
    inputsConsumed: {},
    settlementId: "s-1",
    totalExtraction: 42,
    workers: 3,
  },
  "event.building_destroyed": {
    eventId: "e-1",
    settlementBuildingId: "building-1",
  },
  "event.consumption_multiplier": {
    eventId: "e-1",
    multiplier: 2,
    settlementId: "s-1",
  },
  "event.deposit_discovered": { eventId: "e-1" },
  "event.deposit_destroyed": {
    depositTypeId: "dt-1",
    destroyedCount: 3,
    eventId: "e-1",
  },
  "event.managed_population_change": {
    delta: -2,
    eventId: "e-1",
    managedPopulationId: "mp-1",
  },
  "event.population_boost": {
    amount: 5,
    citizenCount: 15,
    eventId: "e-1",
    settlementId: "s-1",
  },
  "event.population_loss": {
    amount: 5,
    citizenCount: 5,
    eventId: "e-1",
    settlementId: "s-1",
  },
  "event.production_multiplier": {
    eventId: "e-1",
    multiplier: 2,
    settlementId: "s-1",
  },
  "event.resource_drain": {
    amount: 10,
    eventId: "e-1",
    resourceId: "r-1",
    settlementId: "s-1",
  },
  "event.resource_grant": {
    amount: 10,
    eventId: "e-1",
    resourceId: "r-1",
    settlementId: "s-1",
  },
  "event.upkeep_multiplier": {
    eventId: "e-1",
    multiplier: 2,
    settlementId: "s-1",
  },
  "managed_population.declining": {
    husbandryCoverage: 0.5,
    maintenanceCoverage: 0.75,
    managedPopulationInstanceId: "mp-1",
    name: "Cattle",
  },
  "managed_population.extinct": {
    managedPopulationInstanceId: "mp-1",
    name: "Cattle",
  },
  manual_deconstruct_overshoot: {
    current_citizens: 12,
    new_cap: 10,
    settlement_building_id: "building-1",
  },
  "partnership.formed": { citizenAId: "c-a", citizenBId: "c-b" },
  "partnership.widowed": {
    partnershipId: "pt-1",
    survivingCitizenId: "c-a",
  },
  "passive_effect.applied": {
    amount: 3,
    buildingId: "building-1",
    resourceId: "r-1",
    settlementId: "s-1",
    tierId: "t-1",
  },
  "settlement.starvation_occurred": {},
  "settlement.homelessness_occurred": {},
  "stockpile.clamped": {
    delta: -5,
    effectiveCap: 100,
    post: 100,
    pre: 105,
    reason: "over_cap",
    resourceId: "r-1",
    settlementId: "s-1",
  },
  "stockpile.changed": {
    changeAmount: 5,
    changeMode: "flat",
    delta: 5,
    post: 15,
    pre: 10,
    resourceId: "r-1",
    settlementId: "s-1",
  },
  "trade_route.paused": {
    destinationSettlementId: "s-2",
    pauseReason: "insufficient_trader_origin",
    quantityPerTransition: 10,
    resourceId: "r-1",
    tradeRouteId: "route-1",
  },
  "trade_route.resumed": {
    destinationSettlementId: "s-2",
    quantityTransferred: 10,
    resourceId: "r-1",
    tradeRouteId: "route-1",
  },
};

describe("TurnLogPayloadRenderer — all categories render (table-driven)", () => {
  it.each(Object.keys(SAMPLE_PAYLOADS))(
    "renders %s without falling back to raw JSON",
    (logCategory) => {
      const { container } = render(
        <TurnLogPayloadRenderer
          logCategory={logCategory}
          payload={SAMPLE_PAYLOADS[logCategory]}
          lookup={EMPTY_LOOKUP}
          mode="summary"
        />,
      );

      // The summary fallback for unparseable/unknown categories is the em dash;
      // a successful parse+render always produces richer content.
      expect(container.textContent).not.toBe("—");
      expect(container.textContent?.length ?? 0).toBeGreaterThan(0);
    },
  );

  it("falls back to the em dash summary for an unknown category", () => {
    const { container } = render(
      <TurnLogPayloadRenderer
        logCategory="totally.unknown"
        payload={{ some: "thing" }}
        lookup={EMPTY_LOOKUP}
        mode="summary"
      />,
    );

    expect(container.textContent).toBe("—");
  });
});
