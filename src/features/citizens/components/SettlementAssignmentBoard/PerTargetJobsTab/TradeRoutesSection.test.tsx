import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  legs: [
    {
      id: "leg-1",
      direction: "send",
      quantityPerTransition: 10,
      resourceId: "resource-grain",
      resourceName: "Grain",
    },
  ],
  proposedByCitizenId: "citizen-1",
  pauseReasonLastTransition: null,
  replacementForTradeRouteId: null,
};

const defaultProps = {
  canEdit: false,
  countByTradeRouteEnd: new Map<string, number>(),
  queryClient: new QueryClient(),
  tradeRoutes: [baseRoute],
  unassignedNpcCount: 3,
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

    expect(screen.getByText("Trader: Grain → Brindlewood")).toBeInTheDocument();
  });

  it("renders ArrowUpFromLine icon with sending tooltip on local row", () => {
    render(
      <Wrapper>
        <TradeRoutesSection {...defaultProps} settlementId="settlement-a" />
      </Wrapper>,
    );

    const tooltipSpan = document.querySelector(
      "[title='Trading Grain with Brindlewood']",
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

  it("block header shows origin to destination", () => {
    render(
      <Wrapper>
        <TradeRoutesSection {...defaultProps} settlementId="settlement-a" />
      </Wrapper>,
    );

    expect(screen.getByText(/Ashford → Brindlewood/)).toBeInTheDocument();
  });

  it("does not render Apply button when canEdit is false", () => {
    render(
      <Wrapper>
        <TradeRoutesSection {...defaultProps} settlementId="settlement-a" />
      </Wrapper>,
    );

    expect(
      screen.queryByRole("button", { name: "Apply" }),
    ).not.toBeInTheDocument();
  });

  it("renders numeric input and Apply button when canEdit is true", () => {
    render(
      <Wrapper>
        <TradeRoutesSection
          {...defaultProps}
          canEdit
          settlementId="settlement-a"
        />
      </Wrapper>,
    );

    expect(
      screen.getByRole("spinbutton", {
        name: /Target count for Trader: Grain → Brindlewood/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });

  it("Apply is disabled when input matches current count", () => {
    render(
      <Wrapper>
        <TradeRoutesSection
          {...defaultProps}
          canEdit
          settlementId="settlement-a"
        />
      </Wrapper>,
    );

    const applyButton = screen.getByRole("button", { name: "Apply" });
    expect(applyButton).toBeDisabled();
  });

  it("Apply is disabled with tooltip when unassignedNpcCount is 0 and raising", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <TradeRoutesSection
          {...defaultProps}
          canEdit
          settlementId="settlement-a"
          unassignedNpcCount={0}
        />
      </Wrapper>,
    );

    const input = screen.getByRole("spinbutton", {
      name: /Target count for Trader: Grain → Brindlewood/,
    });
    await user.clear(input);
    await user.type(input, "2");

    const applyButton = screen.getByRole("button", { name: "Apply" });
    expect(applyButton).toBeDisabled();
    const tooltipSpan = applyButton.closest("span[title]");
    expect(tooltipSpan).toHaveAttribute(
      "title",
      "No unassigned NPCs available",
    );
  });

  it("shows assigned count / ∞ for the local end", () => {
    const countByTradeRouteEnd = new Map([["route-1:origin", 2]]);
    render(
      <Wrapper>
        <TradeRoutesSection
          {...defaultProps}
          countByTradeRouteEnd={countByTradeRouteEnd}
          settlementId="settlement-a"
        />
      </Wrapper>,
    );

    expect(
      screen.getByText((_, el) => el?.textContent === "2 / ∞"),
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

    expect(screen.getByText("Trader: Grain from Ashford")).toBeInTheDocument();
  });

  it("renders ArrowDownToLine icon with receiving tooltip on local row", () => {
    render(
      <Wrapper>
        <TradeRoutesSection {...defaultProps} settlementId="settlement-b" />
      </Wrapper>,
    );

    const tooltipSpan = document.querySelector(
      "[title='Trading Grain with Ashford']",
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
