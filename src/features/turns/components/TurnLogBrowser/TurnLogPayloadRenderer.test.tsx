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
});
