import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NationCharterPage } from ".";

import type { Nation } from "../../types/nationTypes";
import type { ReactNode } from "react";

const {
  mockNationSettlementsQuery,
  mockCalendarConfigQuery,
  mockPlayerCharactersQuery,
  mockCitizensByIdsQuery,
  mockGovernmentBodiesQuery,
  mockBodyResolverContextQuery,
  mockOfficesRosterQuery,
  mockOfficeTypesQuery,
  mockLawDocumentsQuery,
  mockLawArticlesQuery,
  mockDecreesQuery,
} = vi.hoisted(() => ({
  mockNationSettlementsQuery: vi.fn(),
  mockCalendarConfigQuery: vi.fn(),
  mockPlayerCharactersQuery: vi.fn(),
  mockCitizensByIdsQuery: vi.fn(),
  mockGovernmentBodiesQuery: vi.fn(),
  mockBodyResolverContextQuery: vi.fn(),
  mockOfficesRosterQuery: vi.fn(),
  mockOfficeTypesQuery: vi.fn(),
  mockLawDocumentsQuery: vi.fn(),
  mockLawArticlesQuery: vi.fn(),
  mockDecreesQuery: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    readonly children: ReactNode;
    readonly to: string;
    readonly params?: Readonly<Record<string, string>>;
  }) => {
    const href =
      params === undefined
        ? to
        : Object.entries(params).reduce(
            (path, [name, value]) => path.replace(`$${name}`, value),
            to,
          );
    return <a href={href}>{children}</a>;
  },
}));

vi.mock("../../queries/nationsQueries", () => ({
  nationSettlementsQueryOptions: (nationId: string) => ({
    queryKey: ["nation-settlements", nationId],
    queryFn: () => mockNationSettlementsQuery() as Promise<unknown>,
  }),
}));

vi.mock("@/features/calendar", () => ({
  worldCalendarConfigQueryOptions: (worldId: string) => ({
    queryKey: ["calendar-config", worldId],
    queryFn: () => mockCalendarConfigQuery() as Promise<unknown>,
  }),
}));

vi.mock("@/features/citizens", () => ({
  CitizenAvatar: () => <div />,
  managerScopeLabel: (roleType: string) =>
    roleType === "nation_manager" ? "nation" : null,
  citizensByIdsQueryOptions: (ids: readonly string[]) => ({
    queryKey: ["citizens-by-ids", ids],
    queryFn: () => mockCitizensByIdsQuery() as Promise<unknown>,
    enabled: ids.length > 0,
  }),
  playerCharactersInNationQueryOptions: (nationId: string) => ({
    queryKey: ["player-characters-in-nation", nationId],
    queryFn: () => mockPlayerCharactersQuery() as Promise<unknown>,
  }),
}));

vi.mock("@/features/government-bodies", () => ({
  nationGovernmentBodiesQueryOptions: (nationId: string) => ({
    queryKey: ["nation-government-bodies", nationId],
    queryFn: () => mockGovernmentBodiesQuery() as Promise<unknown>,
  }),
  nationBodyResolverContextQueryOptions: (nationId: string) => ({
    queryKey: ["nation-body-resolver-context", nationId],
    queryFn: () => mockBodyResolverContextQuery() as Promise<unknown>,
  }),
}));

vi.mock("../../queries/officesQueries", () => ({
  nationOfficesRosterQueryOptions: (nationId: string) => ({
    queryKey: ["nation-offices-roster", nationId],
    queryFn: () => mockOfficesRosterQuery() as Promise<unknown>,
  }),
}));

vi.mock("../../queries/officeTypesQueries", () => ({
  nationOfficeTypesQueryOptions: (worldId: string, nationId: string) => ({
    queryKey: ["nation-office-types", worldId, nationId],
    queryFn: () => mockOfficeTypesQuery() as Promise<unknown>,
  }),
}));

vi.mock("@/features/law-documents", () => ({
  LawDocumentVersionBrowser: () => <div />,
  nationLawDocumentsQueryOptions: (nationId: string) => ({
    queryKey: ["nation-law-documents", nationId],
    queryFn: () => mockLawDocumentsQuery() as Promise<unknown>,
  }),
  lawDocumentArticlesQueryOptions: (documentId: string) => ({
    queryKey: ["law-document-articles", documentId],
    queryFn: () => mockLawArticlesQuery() as Promise<unknown>,
  }),
}));

vi.mock("@/features/decrees", () => ({
  nationDecreesQueryOptions: (nationId: string) => ({
    queryKey: ["nation-decrees", nationId],
    queryFn: () => mockDecreesQuery() as Promise<unknown>,
  }),
}));

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function createNation(): Nation {
  return {
    capitalSettlementId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    flagPath: null,
    foundedTurnNumber: null,
    governmentType: "monarchy",
    id: "nation-1",
    name: "Ironhaven",
    namesetId: null,
    primaryCultureId: null,
    sealPath: null,
    stateReligionId: null,
    taxRate: 0,
    tradePolicy: "free",
    updatedAt: "2026-01-01T00:00:00.000Z",
    worldId: "world-1",
  };
}

function renderCharterPage(): void {
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <NationCharterPage nation={createNation()} worldId="world-1" />
    </QueryClientProvider>,
  );
}

describe("NationCharterPage", () => {
  it("renders every section with graceful empty states when the nation has nothing configured", async () => {
    mockNationSettlementsQuery.mockResolvedValue([]);
    mockCalendarConfigQuery.mockResolvedValue(null);
    mockPlayerCharactersQuery.mockResolvedValue([]);
    mockCitizensByIdsQuery.mockResolvedValue([]);
    mockGovernmentBodiesQuery.mockResolvedValue([]);
    mockBodyResolverContextQuery.mockResolvedValue({
      officeHolders: [],
      rulerCitizenId: null,
      settlementManagers: [],
    });
    mockOfficesRosterQuery.mockResolvedValue([]);
    mockOfficeTypesQuery.mockResolvedValue([]);
    mockLawDocumentsQuery.mockResolvedValue([]);
    mockLawArticlesQuery.mockResolvedValue([]);
    mockDecreesQuery.mockResolvedValue({ decrees: [], totalCount: 0 });

    renderCharterPage();

    expect(await screen.findByText("Ironhaven")).toBeInTheDocument();
    expect(screen.getByText("Monarchy")).toBeInTheDocument();
    expect(await screen.findByText(/currently vacant/i)).toBeInTheDocument();
    expect(await screen.findByText("No government bodies")).toBeInTheDocument();
    expect(await screen.findByText("No offices")).toBeInTheDocument();
    expect(await screen.findByText("No active documents")).toBeInTheDocument();
    expect(await screen.findByText("No decrees")).toBeInTheDocument();
    expect(await screen.findByText("No settlements")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /print charter/i }),
    ).toBeInTheDocument();
  });
});
