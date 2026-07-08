import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as CitizensFeature from "@/features/citizens";
import type { Citizen } from "@/features/citizens";

import { NationIdentitySection } from "./IdentitySection";

import type { Nation, NationSettlement } from "../../types/nationTypes";
import type { ReactNode } from "react";

const {
  mockCitizensQuery,
  mockSettlementsQuery,
  mockCalendarConfigQuery,
  mockSetCapitalAndFoundedTurn,
  mockSetGovernmentType,
  mockNotifyError,
  mockUseActivePlayerCharacter,
} = vi.hoisted(() => ({
  mockCitizensQuery: vi.fn(),
  mockSettlementsQuery: vi.fn(),
  mockCalendarConfigQuery: vi.fn(),
  mockSetCapitalAndFoundedTurn: vi.fn(),
  mockSetGovernmentType: vi.fn(),
  mockNotifyError: vi.fn(),
  mockUseActivePlayerCharacter: vi.fn<
    () => {
      readonly activeCharacter: {
        readonly id: string;
        readonly roleNationId: string | null;
        readonly roleType: string;
        readonly status: string;
      } | null;
    }
  >(() => ({ activeCharacter: null })),
}));

vi.mock("@/features/citizens", async () => {
  const actual = await vi.importActual<typeof CitizensFeature>(
    "@/features/citizens",
  );
  return {
    ...actual,
    playerCharactersInNationQueryOptions: (nationId: string) => ({
      queryKey: ["player-characters-in-nation", nationId],
      queryFn: () => mockCitizensQuery() as Promise<unknown>,
    }),
  };
});

vi.mock("../../queries/nationsQueries", () => ({
  nationSettlementsQueryOptions: (nationId: string) => ({
    queryKey: ["nation-settlements", nationId],
    queryFn: () => mockSettlementsQuery() as Promise<unknown>,
  }),
}));

vi.mock("@/features/calendar", () => ({
  worldCalendarConfigQueryOptions: (worldId: string) => ({
    queryKey: ["world-calendar-config", worldId],
    queryFn: () => mockCalendarConfigQuery() as Promise<unknown>,
  }),
}));

vi.mock("../../mutations/nationsMutations", () => ({
  setNationCapitalAndFoundedTurnMutationOptions: vi.fn(
    () =>
      ({
        mutationFn: mockSetCapitalAndFoundedTurn,
      }) as never,
  ),
  setNationGovernmentTypeMutationOptions: vi.fn(
    () =>
      ({
        mutationFn: mockSetGovernmentType,
      }) as never,
  ),
}));

vi.mock("@/lib/notify", () => ({
  notifyMutationError: mockNotifyError,
}));

vi.mock("@/features/permissions", () => ({
  useActivePlayerCharacter: mockUseActivePlayerCharacter,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    readonly children: ReactNode;
    readonly to: string;
    readonly params: Record<string, string>;
  }) => {
    const href = Object.entries(params).reduce(
      (path, [name, value]) => path.replace(`$${name}`, value),
      to,
    );
    return <a href={href}>{children}</a>;
  },
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000101";
const NATION_ID = "11111111-1111-1111-1111-111111111111";
const SETTLEMENT_ID = "22222222-2222-2222-2222-222222222222";
const CITIZEN_ID = "33333333-3333-3333-3333-333333333333";

function createNation(overrides: Partial<Nation> = {}): Nation {
  return {
    capitalSettlementId: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    description: null,
    flagPath: null,
    foundedTurnNumber: null,
    governmentType: "monarchy",
    id: NATION_ID,
    name: "Aldoria",
    namesetId: null,
    primaryCultureId: null,
    stateReligionId: null,
    taxRate: 0,
    tradePolicy: "free",
    updatedAt: "2026-05-01T00:00:00.000Z",
    worldId: WORLD_ID,
    ...overrides,
  };
}

function createCitizen(overrides: Partial<Citizen> = {}): Citizen {
  return {
    bornOnTurnNumber: null,
    citizenType: "npc",
    createdAt: "2026-05-01T00:00:00.000Z",
    cultureId: null,
    deathCause: null,
    deathCauseCategory: null,
    givenName: "Rowan",
    id: CITIZEN_ID,
    name: "Rowan",
    namesetId: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    profilePhotoUrl: null,
    religionId: null,
    roleNationId: null,
    roleSettlementId: null,
    roleType: "none",
    settlementId: SETTLEMENT_ID,
    sex: null,
    status: "alive",
    surname: null,
    updatedAt: "2026-05-01T00:00:00.000Z",
    userId: null,
    worldId: WORLD_ID,
    ...overrides,
  };
}

function createSettlement(
  overrides: Partial<NationSettlement> = {},
): NationSettlement {
  return {
    autoReadyEnabled: false,
    id: SETTLEMENT_ID,
    isReadyCurrentTurn: false,
    isReadyForCurrentTurn: false,
    lastReadyAt: null,
    name: "Rivermouth",
    nationId: NATION_ID,
    nationName: "Aldoria",
    population: 10,
    readySetAt: null,
    ...overrides,
  };
}

function renderSection(
  nation: Nation,
  { canAdminWorld = false }: { readonly canAdminWorld?: boolean } = {},
): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NationIdentitySection
        canAdminWorld={canAdminWorld}
        isArchived={false}
        nation={nation}
        queryClient={queryClient}
      />
    </QueryClientProvider>,
  );
}

describe("NationIdentitySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCitizensQuery.mockResolvedValue([]);
    mockSettlementsQuery.mockResolvedValue([]);
    mockCalendarConfigQuery.mockResolvedValue(null);
    mockUseActivePlayerCharacter.mockReturnValue({ activeCharacter: null });
  });

  it("shows Vacant when no citizen holds the nation manager role", async () => {
    renderSection(createNation());

    expect(await screen.findByText("Vacant")).toBeInTheDocument();
  });

  it("links to the citizen holding the nation manager role for this nation", async () => {
    mockCitizensQuery.mockResolvedValue([
      createCitizen({ roleNationId: NATION_ID, roleType: "nation_manager" }),
    ]);

    renderSection(createNation());

    const rulerLink = await screen.findByRole("link", { name: "Rowan" });
    expect(rulerLink).toHaveAttribute(
      "href",
      `/worlds/${WORLD_ID}/citizens/${CITIZEN_ID}`,
    );
  });

  it("ignores a nation manager role assigned to a different nation", async () => {
    mockCitizensQuery.mockResolvedValue([
      createCitizen({
        roleNationId: "other-nation",
        roleType: "nation_manager",
      }),
    ]);

    renderSection(createNation());

    expect(await screen.findByText("Vacant")).toBeInTheDocument();
  });

  it("links the capital to the settlement page when set", async () => {
    mockSettlementsQuery.mockResolvedValue([createSettlement()]);

    renderSection(createNation({ capitalSettlementId: SETTLEMENT_ID }));

    const capitalLink = await screen.findByRole("link", {
      name: "Rivermouth",
    });
    expect(capitalLink).toHaveAttribute(
      "href",
      `/worlds/${WORLD_ID}/nations/${NATION_ID}/settlements/${SETTLEMENT_ID}`,
    );
  });

  it("shows Not set when no capital is assigned", async () => {
    renderSection(createNation());

    expect(await screen.findByText("Not set")).toBeInTheDocument();
  });

  it("falls back to a plain turn label when founded but calendar config is unavailable", async () => {
    renderSection(createNation({ foundedTurnNumber: 12 }));

    expect(await screen.findByText("Turn 12")).toBeInTheDocument();
  });

  it("hides edit controls when the caller lacks manage authority", async () => {
    mockSettlementsQuery.mockResolvedValue([createSettlement()]);
    renderSection(createNation({ capitalSettlementId: SETTLEMENT_ID }), {
      canAdminWorld: false,
    });

    await screen.findByText("Rivermouth");
    expect(
      screen.queryByRole("button", { name: "Change capital" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit founded turn" }),
    ).not.toBeInTheDocument();
  });

  it("shows edit controls when the caller has manage authority", async () => {
    mockSettlementsQuery.mockResolvedValue([createSettlement()]);
    renderSection(createNation({ capitalSettlementId: SETTLEMENT_ID }), {
      canAdminWorld: true,
    });

    expect(
      await screen.findByRole("button", { name: "Change capital" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit founded turn" }),
    ).toBeInTheDocument();
  });

  it("shows edit controls for this nation's alive nation_manager even without world admin", async () => {
    mockUseActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID,
        roleNationId: NATION_ID,
        roleType: "nation_manager",
        status: "alive",
      },
    });
    mockSettlementsQuery.mockResolvedValue([createSettlement()]);
    renderSection(createNation({ capitalSettlementId: SETTLEMENT_ID }), {
      canAdminWorld: false,
    });

    expect(
      await screen.findByRole("button", { name: "Change capital" }),
    ).toBeInTheDocument();
  });

  it("only lists this nation's settlements in the capital picker", async () => {
    mockSettlementsQuery.mockResolvedValue([
      createSettlement({ id: SETTLEMENT_ID, name: "Rivermouth" }),
      createSettlement({
        id: "44444444-4444-4444-4444-444444444444",
        name: "Stonegate",
      }),
    ]);
    renderSection(createNation(), { canAdminWorld: true });

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Change capital" }),
    );

    const select = screen.getByLabelText("Capital settlement");
    const options = Array.from(select.querySelectorAll("option")).map(
      (option) => option.textContent,
    );
    expect(options).toEqual(["None", "Rivermouth", "Stonegate"]);
  });

  it("submits the founded turn edit through the mutation, keeping the existing capital", async () => {
    mockSetCapitalAndFoundedTurn.mockResolvedValue(
      createNation({ foundedTurnNumber: 7 }),
    );
    renderSection(
      createNation({
        capitalSettlementId: SETTLEMENT_ID,
        foundedTurnNumber: 5,
      }),
      { canAdminWorld: true },
    );

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Edit founded turn" }),
    );
    const input = screen.getByLabelText("Founded turn");
    await user.clear(input);
    await user.type(input, "7");
    await user.click(screen.getByRole("button", { name: "Save founded turn" }));

    await waitFor(() => {
      expect(mockSetCapitalAndFoundedTurn).toHaveBeenCalledWith(
        {
          capitalSettlementId: SETTLEMENT_ID,
          foundedTurnNumber: 7,
          nationId: NATION_ID,
          worldId: WORLD_ID,
        },
        expect.anything(),
      );
    });
  });

  it("shows the government type", async () => {
    renderSection(createNation({ governmentType: "republic" }));

    expect(await screen.findByText("Republic")).toBeInTheDocument();
  });

  it("hides the government type edit control for a nation manager", async () => {
    mockUseActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID,
        roleNationId: NATION_ID,
        roleType: "nation_manager",
        status: "alive",
      },
    });
    renderSection(createNation(), { canAdminWorld: false });

    await screen.findByText("Monarchy");
    expect(
      screen.queryByRole("button", { name: "Change government type" }),
    ).not.toBeInTheDocument();
  });

  it("shows the government type edit control for a world admin", async () => {
    renderSection(createNation(), { canAdminWorld: true });

    expect(
      await screen.findByRole("button", { name: "Change government type" }),
    ).toBeInTheDocument();
  });

  it("submits the government type edit through the mutation", async () => {
    mockSetGovernmentType.mockResolvedValue(
      createNation({ governmentType: "republic" }),
    );
    renderSection(createNation(), { canAdminWorld: true });

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Change government type" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Government type"),
      "republic",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockSetGovernmentType).toHaveBeenCalledWith(
        {
          governmentType: "republic",
          nationId: NATION_ID,
          worldId: WORLD_ID,
        },
        expect.anything(),
      );
    });
  });
});
