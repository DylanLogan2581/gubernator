import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NationRelationshipsSection } from "./RelationshipsSection";

import type { NationRelationship } from "../../types/nationRelationshipTypes";
import type { NationTreaty } from "../../types/nationTreatyTypes";
import type { Nation } from "../../types/nationTypes";

const {
  mockNationsListQuery,
  mockOutgoingQuery,
  mockIncomingQuery,
  mockTreatiesQuery,
  mockResourcesQuery,
  mockCalendarQuery,
  mockCitizensByIdsQuery,
} = vi.hoisted(() => ({
  mockNationsListQuery: vi.fn(),
  mockOutgoingQuery: vi.fn(),
  mockIncomingQuery: vi.fn(),
  mockTreatiesQuery: vi.fn(),
  mockResourcesQuery: vi.fn(),
  mockCalendarQuery: vi.fn(),
  mockCitizensByIdsQuery: vi.fn(),
}));

vi.mock("../../queries/nationsQueries", () => ({
  nationsListQueryOptions: () => ({
    queryFn: () => mockNationsListQuery() as Promise<unknown>,
    queryKey: ["nations-list"],
  }),
}));

vi.mock("../../queries/nationRelationshipQueries", () => ({
  nationRelationshipsFromNationQueryOptions: () => ({
    queryFn: () => mockOutgoingQuery() as Promise<unknown>,
    queryKey: ["nation-relationships-from"],
  }),
  nationRelationshipsToNationQueryOptions: () => ({
    queryFn: () => mockIncomingQuery() as Promise<unknown>,
    queryKey: ["nation-relationships-to"],
  }),
}));

vi.mock("../../queries/treatiesQueries", () => ({
  nationTreatiesQueryOptions: () => ({
    queryFn: () => mockTreatiesQuery() as Promise<unknown>,
    queryKey: ["nation-treaties"],
  }),
}));

vi.mock("@/features/resources", () => ({
  activeResourcesByWorldQueryOptions: () => ({
    queryFn: () => mockResourcesQuery() as Promise<unknown>,
    queryKey: ["active-resources"],
  }),
}));

vi.mock("@/features/calendar", () => ({
  worldCalendarConfigQueryOptions: () => ({
    queryFn: () => mockCalendarQuery() as Promise<unknown>,
    queryKey: ["world-calendar-config"],
  }),
}));

vi.mock("@/features/citizens", () => ({
  citizensByIdsQueryOptions: (ids: readonly string[]) => ({
    enabled: ids.length > 0,
    queryFn: () => mockCitizensByIdsQuery() as Promise<unknown>,
    queryKey: ["citizens-by-ids", ids],
  }),
}));

vi.mock("@/features/permissions", () => ({
  useActivePlayerCharacter: () => ({ activeCharacter: null }),
}));

const nation: Nation = {
  capitalSettlementId: null,
  createdAt: "2024-01-01T00:00:00Z",
  description: null,
  flagPath: null,
  foundedTurnNumber: null,
  governmentType: "monarchy",
  id: "11111111-1111-1111-1111-111111111111",
  name: "Highmark",
  namesetId: null,
  taxRate: 0,
  tradePolicy: "free",
  updatedAt: "2024-01-01T00:00:00Z",
  worldId: "00000000-0000-0000-0000-000000000101",
};

const other: Nation = {
  capitalSettlementId: null,
  createdAt: "2024-01-01T00:00:00Z",
  description: null,
  flagPath: null,
  foundedTurnNumber: null,
  governmentType: "monarchy",
  id: "22222222-2222-2222-2222-222222222222",
  name: "Rivenhold",
  namesetId: null,
  taxRate: 0,
  tradePolicy: "free",
  updatedAt: "2024-01-01T00:00:00Z",
  worldId: "00000000-0000-0000-0000-000000000101",
};

function renderSection(): ReturnType<typeof render> {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NationRelationshipsSection
        canAdminWorld={true}
        isArchived={false}
        nation={nation}
        queryClient={queryClient}
      />
    </QueryClientProvider>,
  );
}

describe("NationRelationshipAccordionRow", () => {
  beforeEach(() => {
    mockTreatiesQuery.mockResolvedValue([]);
    mockResourcesQuery.mockResolvedValue([]);
    mockCalendarQuery.mockResolvedValue(null);
    mockCitizensByIdsQuery.mockResolvedValue([]);
  });

  it("shows the stance as text without expanding the row", async () => {
    mockNationsListQuery.mockResolvedValue([nation, other]);
    mockOutgoingQuery.mockResolvedValue([
      {
        createdAt: "2024-01-01T00:00:00Z",
        currentStance: "friendly",
        fromNationId: nation.id,
        id: "rel-1",
        pendingChangedByCitizenId: null,
        pendingStance: null,
        pendingStatus: null,
        toNationId: other.id,
        updatedAt: "2024-01-01T00:00:00Z",
      } satisfies NationRelationship,
    ]);
    mockIncomingQuery.mockResolvedValue([]);

    renderSection();

    expect(await screen.findByText("Friendly")).toBeInTheDocument();
  });

  it("shows a distinct color class per stance", async () => {
    mockNationsListQuery.mockResolvedValue([nation, other]);
    mockOutgoingQuery.mockResolvedValue([
      {
        createdAt: "2024-01-01T00:00:00Z",
        currentStance: "hostile",
        fromNationId: nation.id,
        id: "rel-1",
        pendingChangedByCitizenId: null,
        pendingStance: null,
        pendingStatus: null,
        toNationId: other.id,
        updatedAt: "2024-01-01T00:00:00Z",
      } satisfies NationRelationship,
    ]);
    mockIncomingQuery.mockResolvedValue([]);

    renderSection();

    const badge = await screen.findByText("Hostile");
    expect(badge.className).toContain("orange");
  });

  it("shows pending proposal count on the collapsed row", async () => {
    mockNationsListQuery.mockResolvedValue([nation, other]);
    mockOutgoingQuery.mockResolvedValue([
      {
        createdAt: "2024-01-01T00:00:00Z",
        currentStance: "neutral",
        fromNationId: nation.id,
        id: "rel-1",
        pendingChangedByCitizenId: null,
        pendingStance: "allied",
        pendingStatus: "proposed",
        toNationId: other.id,
        updatedAt: "2024-01-01T00:00:00Z",
      } satisfies NationRelationship,
    ]);
    mockIncomingQuery.mockResolvedValue([]);

    renderSection();

    expect(await screen.findByText(/1 pending proposal/)).toBeInTheDocument();
  });

  it("does not show a pending badge when there is no pending proposal", async () => {
    mockNationsListQuery.mockResolvedValue([nation, other]);
    mockOutgoingQuery.mockResolvedValue([]);
    mockIncomingQuery.mockResolvedValue([]);

    renderSection();

    await screen.findByText("Neutral");
    expect(screen.queryByText(/pending proposal/)).not.toBeInTheDocument();
  });

  it("folds a pending treaty proposal into the collapsed pending count", async () => {
    mockNationsListQuery.mockResolvedValue([nation, other]);
    mockOutgoingQuery.mockResolvedValue([]);
    mockIncomingQuery.mockResolvedValue([]);
    mockTreatiesQuery.mockResolvedValue([
      {
        createdAt: "2024-01-01T00:00:00Z",
        endsTurnNumber: null,
        id: "treaty-1",
        proposedByCitizenId: "citizen-1",
        proposerNationId: other.id,
        respondedByCitizenId: null,
        responderNationId: nation.id,
        startsTurnNumber: null,
        status: "proposed",
        terms: {},
        treatyType: "trade_agreement",
        updatedAt: "2024-01-01T00:00:00Z",
        worldId: nation.worldId,
      } satisfies NationTreaty,
    ]);

    renderSection();

    expect(await screen.findByText(/1 pending proposal/)).toBeInTheDocument();
  });

  it("renders treaty terms once the row is expanded", async () => {
    mockNationsListQuery.mockResolvedValue([nation, other]);
    mockOutgoingQuery.mockResolvedValue([]);
    mockIncomingQuery.mockResolvedValue([]);
    mockTreatiesQuery.mockResolvedValue([
      {
        createdAt: "2024-01-01T00:00:00Z",
        endsTurnNumber: null,
        id: "treaty-1",
        proposedByCitizenId: "citizen-1",
        proposerNationId: nation.id,
        respondedByCitizenId: null,
        responderNationId: other.id,
        startsTurnNumber: null,
        status: "active",
        terms: {},
        treatyType: "trade_agreement",
        updatedAt: "2024-01-01T00:00:00Z",
        worldId: nation.worldId,
      } satisfies NationTreaty,
    ]);

    renderSection();

    fireEvent.click(await screen.findByText(other.name));

    expect(
      await screen.findByText(
        `Trade agreement between ${nation.name} and ${other.name}`,
      ),
    ).toBeInTheDocument();
  });
});
