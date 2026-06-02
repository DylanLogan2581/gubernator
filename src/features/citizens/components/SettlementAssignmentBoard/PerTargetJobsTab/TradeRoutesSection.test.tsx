import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TradeRoute } from "@/features/trade";

import { TradeRoutesSection } from "./TradeRoutesSection";

import type { JSX, ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

function Wrapper({ children }: { readonly children: ReactNode }): JSX.Element {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const baseRoute: TradeRoute = {
  id: "route-1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  status: "active",
  originSettlementId: "settlement-a",
  originSettlementName: "Ashford",
  originNationName: "Nation A",
  originApprovalStatus: "approved",
  originApprovedByCitizenId: null,
  destinationSettlementId: "settlement-b",
  destinationSettlementName: "Brindlewood",
  destinationNationName: "Nation B",
  destinationApprovalStatus: "approved",
  destinationApprovedByCitizenId: null,
  resourceId: "resource-grain",
  resourceName: "Grain",
  quantityPerTransition: 10,
  proposedByCitizenId: "citizen-1",
  pauseReasonLastTransition: null,
  replacementForTradeRouteId: null,
};

const defaultProps = {
  aliveCitizens: [],
  assignedByTradeRouteEnd: new Map<string, readonly string[]>(),
  canEdit: false,
  citizenMap: new Map(),
  queryClient: new QueryClient(),
  tradeRoutes: [baseRoute],
};

describe("TradeRoutesSection — sending (origin) variant", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReturnValue({});
  });

  it("renders the correct label for the local (origin) end", () => {
    render(
      <Wrapper>
        <TradeRoutesSection {...defaultProps} settlementId="settlement-a" />
      </Wrapper>,
    );

    expect(
      screen.getByText("Trader (sending): Grain → Brindlewood"),
    ).toBeInTheDocument();
  });

  it("renders ArrowUpFromLine icon with sending tooltip on local row", () => {
    render(
      <Wrapper>
        <TradeRoutesSection {...defaultProps} settlementId="settlement-a" />
      </Wrapper>,
    );

    const tooltipSpan = document.querySelector(
      "[title='Sending Grain to Brindlewood']",
    );
    expect(tooltipSpan).toBeInTheDocument();
    const icon = tooltipSpan?.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the remote (destination) end with receiving label", () => {
    render(
      <Wrapper>
        <TradeRoutesSection {...defaultProps} settlementId="settlement-a" />
      </Wrapper>,
    );

    expect(
      screen.getByText(/Trader \(receiving — remote\): Brindlewood/),
    ).toBeInTheDocument();
  });

  it("block header has aria-label describing resource flow", () => {
    render(
      <Wrapper>
        <TradeRoutesSection {...defaultProps} settlementId="settlement-a" />
      </Wrapper>,
    );

    expect(
      screen.getByRole("paragraph", {
        name: "Grain travels from Ashford to Brindlewood",
      }),
    ).toBeInTheDocument();
  });
});

describe("TradeRoutesSection — receiving (destination) variant", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReturnValue({});
  });

  it("renders the correct label for the local (destination) end", () => {
    render(
      <Wrapper>
        <TradeRoutesSection {...defaultProps} settlementId="settlement-b" />
      </Wrapper>,
    );

    expect(
      screen.getByText("Trader (receiving): Grain from Ashford"),
    ).toBeInTheDocument();
  });

  it("renders ArrowDownToLine icon with receiving tooltip on local row", () => {
    render(
      <Wrapper>
        <TradeRoutesSection {...defaultProps} settlementId="settlement-b" />
      </Wrapper>,
    );

    const tooltipSpan = document.querySelector(
      "[title='Receiving Grain from Ashford']",
    );
    expect(tooltipSpan).toBeInTheDocument();
    const icon = tooltipSpan?.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the remote (origin) end with sending label", () => {
    render(
      <Wrapper>
        <TradeRoutesSection {...defaultProps} settlementId="settlement-b" />
      </Wrapper>,
    );

    expect(
      screen.getByText(/Trader \(sending — remote\): Ashford/),
    ).toBeInTheDocument();
  });
});
