import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NationRelationshipsSection } from "./RelationshipsSection";

import type { NationRelationship } from "../../types/nationRelationshipTypes";
import type { Nation } from "../../types/nationTypes";

const { mockNationsListQuery, mockOutgoingQuery, mockIncomingQuery } =
  vi.hoisted(() => ({
    mockNationsListQuery: vi.fn(),
    mockOutgoingQuery: vi.fn(),
    mockIncomingQuery: vi.fn(),
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
});
