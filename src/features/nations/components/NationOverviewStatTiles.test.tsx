import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NationOverviewStatTiles } from "./NationOverviewStatTiles";

const { mockSettlementsQuery, mockCurrencyQuery, mockActiveEventsQuery } =
  vi.hoisted(() => ({
    mockSettlementsQuery: vi.fn(),
    mockCurrencyQuery: vi.fn(),
    mockActiveEventsQuery: vi.fn(),
  }));

vi.mock("../queries/nationsQueries", () => ({
  nationSettlementsQueryOptions: (nationId: string) => ({
    queryKey: ["nation-settlements", nationId],
    queryFn: () => mockSettlementsQuery() as Promise<unknown>,
  }),
}));

vi.mock("../queries/currencyQueries", () => ({
  nationCurrencyQueryOptions: (nationId: string) => ({
    queryKey: ["nation-currency", nationId],
    queryFn: () => mockCurrencyQuery() as Promise<unknown>,
  }),
}));

vi.mock("@/features/events", () => ({
  activeNationEventsQueryOptions: (worldId: string, nationId: string) => ({
    queryKey: ["active-nation-events", worldId, nationId],
    queryFn: () => mockActiveEventsQuery() as Promise<unknown>,
  }),
}));

const NATION_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "00000000-0000-0000-0000-000000000101";

function renderTiles(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NationOverviewStatTiles nationId={NATION_ID} worldId={WORLD_ID} />
    </QueryClientProvider>,
  );
}

describe("NationOverviewStatTiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettlementsQuery.mockResolvedValue([]);
    mockCurrencyQuery.mockResolvedValue(null);
    mockActiveEventsQuery.mockResolvedValue([]);
  });

  it("does not show a relationships tile", async () => {
    renderTiles();

    expect(await screen.findByText("Settlements")).toBeInTheDocument();
    expect(screen.queryByText("Relationships")).not.toBeInTheDocument();
  });

  it("shows treasury as none when no currency is established", async () => {
    renderTiles();

    expect(await screen.findByText("Treasury")).toBeInTheDocument();
    expect(await screen.findByText("None")).toBeInTheDocument();
    expect(screen.getByText("No currency established")).toBeInTheDocument();
  });

  it("shows the money supply and currency type when a currency is established", async () => {
    mockCurrencyQuery.mockResolvedValue({
      backingRatio: null,
      backingResourceId: null,
      confidence: 1,
      currencyType: "fiat",
      establishedTurnNumber: 3,
      id: "currency-1",
      moneySupply: 12500,
      name: "Aldorian Crown",
      nationId: NATION_ID,
      reserveQuantity: 0,
      symbol: "₳",
      worldId: WORLD_ID,
    });

    renderTiles();

    expect(await screen.findByText("₳12,500")).toBeInTheDocument();
    expect(screen.getByText("Fiat")).toBeInTheDocument();
  });
});
