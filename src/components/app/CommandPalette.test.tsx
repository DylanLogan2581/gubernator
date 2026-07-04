import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Citizen } from "@/features/citizens";
import { ActivePlayerCharacterContext } from "@/features/permissions";
import type { ActivePlayerCharacterContextValue } from "@/features/permissions";
import type * as PermissionsModule from "@/features/permissions";

import { CommandPalette } from "./CommandPalette";

// jsdom lacks scrollIntoView, which cmdk calls when the selected item changes.
// eslint-disable-next-line @typescript-eslint/unbound-method
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const WORLD_ID = "world-1";
const NATION_ID = "nation-1";
const SETTLEMENT_ID = "settlement-1";

const {
  citizensQueryState,
  navigateMock,
  useAppShellWorldContextMock,
  useSettlementReadinessActionMock,
  useWorldScopeMock,
} = vi.hoisted(() => ({
  citizensQueryState: { isPending: false },
  navigateMock: vi.fn(),
  useAppShellWorldContextMock: vi.fn(),
  useSettlementReadinessActionMock: vi.fn(),
  useWorldScopeMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("./sidebar/UseAppShellWorldContext", () => ({
  useAppShellWorldContext: useAppShellWorldContextMock,
}));

vi.mock("./sidebar/WorldScopeContext", () => ({
  useWorldScope: useWorldScopeMock,
}));

vi.mock("./UseSettlementReadinessAction", () => ({
  useSettlementReadinessAction: useSettlementReadinessActionMock,
}));

vi.mock("@/features/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof PermissionsModule>();
  return {
    ...actual,
    // eslint-disable-next-line @tanstack/query/exhaustive-deps -- `actual` is a static module reference, not reactive state
    currentAccessContextQueryOptions: () => ({
      queryFn: () =>
        Promise.resolve(
          actual.createAccessContext({
            isSuperAdmin: false,
            userId: "user-1",
            worldAdminWorldIds: [],
          }),
        ),
      queryKey: ["test", "access-context"],
    }),
  };
});

vi.mock("@/features/worlds", () => ({
  accessibleWorldsQueryOptions: () => ({
    queryFn: () => Promise.resolve(WORLDS_FIXTURE),
    queryKey: ["test", "worlds"],
  }),
  // Real WorldAvatar resolves a signed URL via the Supabase client, which
  // isn't configured in this test's module graph — stub it to a no-op.
  WorldAvatar: () => null,
}));

vi.mock("@/features/nations", () => ({
  nationsListQueryOptions: (worldId: string) => ({
    queryFn: () => Promise.resolve(NATIONS_FIXTURE),
    queryKey: ["test", "nations", worldId],
  }),
}));

vi.mock("@/features/settlements", () => ({
  settlementsByWorldQueryOptions: (worldId: string) => ({
    queryFn: () => Promise.resolve(SETTLEMENTS_FIXTURE),
    queryKey: ["test", "settlements", worldId],
  }),
}));

vi.mock("@/features/citizens", () => ({
  citizensInWorldQueryOptions: (worldId: string) => ({
    // Never resolves while citizensQueryState.isPending is true, so tests can
    // exercise the loading-skeleton branch.
    queryFn: () =>
      citizensQueryState.isPending
        ? new Promise<never>(() => {})
        : Promise.resolve(CITIZENS_FIXTURE),
    queryKey: ["test", "citizens", worldId],
  }),
}));

const WORLDS_FIXTURE = [
  {
    currentTurnNumber: 5,
    id: "world-2",
    inWorldDateLabel: "Spring, Y3",
    name: "Eastern Marches",
  },
];

const NATIONS_FIXTURE = [{ id: NATION_ID, name: "Ironmark" }];

const SETTLEMENTS_FIXTURE = [
  {
    id: SETTLEMENT_ID,
    name: "Amberhold",
    nationId: NATION_ID,
    nationName: "Ironmark",
  },
];

const CITIZENS_FIXTURE = [
  {
    citizenType: "player_character",
    id: "citizen-1",
    name: "Alaric Stormwind",
  },
  { citizenType: "npc", id: "citizen-2", name: "Beren Thistlewood" },
];

describe("CommandPalette", () => {
  beforeEach(() => {
    citizensQueryState.isPending = false;
    navigateMock.mockReset();
    useAppShellWorldContextMock.mockReset();
    useAppShellWorldContextMock.mockReturnValue({
      canAdmin: false,
      worldId: null,
    });
    useWorldScopeMock.mockReset();
    useWorldScopeMock.mockReturnValue({
      isPending: false,
      nationId: null,
      settlementId: null,
    });
    useSettlementReadinessActionMock.mockReset();
    useSettlementReadinessActionMock.mockReturnValue({
      isToggleDisabled: false,
      isVisible: false,
      item: null,
      toggle: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on Ctrl+K when closed", () => {
    const onOpenChange = vi.fn();
    renderPalette({ onOpenChange, open: false });

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { ctrlKey: true, key: "k" }),
      );
    });

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("closes on Ctrl+K when open", () => {
    const onOpenChange = vi.fn();
    renderPalette({ onOpenChange, open: true });

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { ctrlKey: true, key: "k" }),
      );
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("lists accessible worlds and navigates on select", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPalette({ onOpenChange });

    await user.click(await screen.findByText("Eastern Marches"));

    expect(navigateMock).toHaveBeenCalledWith({
      params: { worldId: "world-2" },
      to: "/worlds/$worldId",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("lists nations, settlements, and citizens inside a world", async () => {
    useAppShellWorldContextMock.mockReturnValue({
      canAdmin: false,
      worldId: WORLD_ID,
    });
    renderPalette();

    expect((await screen.findAllByText("Ironmark")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Amberhold")).toBeDefined();
    expect(await screen.findByText("Alaric Stormwind")).toBeDefined();
    expect(await screen.findByText("Beren Thistlewood")).toBeDefined();
  });

  it("shows a loading skeleton while entity queries are pending", async () => {
    citizensQueryState.isPending = true;
    useAppShellWorldContextMock.mockReturnValue({
      canAdmin: false,
      worldId: WORLD_ID,
    });
    renderPalette();

    expect(await screen.findByTestId("command-palette-skeleton")).toBeDefined();
  });

  it("navigates to a settlement using its own nation scope", async () => {
    useAppShellWorldContextMock.mockReturnValue({
      canAdmin: false,
      worldId: WORLD_ID,
    });
    const user = userEvent.setup();
    renderPalette();

    await user.click(await screen.findByText("Amberhold"));

    expect(navigateMock).toHaveBeenCalledWith({
      params: {
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
      },
      to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
    });
  });

  it("filters results after the search debounce", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: (ms) => {
        vi.advanceTimersByTime(ms);
      },
    });
    useAppShellWorldContextMock.mockReturnValue({
      canAdmin: false,
      worldId: WORLD_ID,
    });
    renderPalette();

    await screen.findByText("Alaric Stormwind");

    await user.type(screen.getByPlaceholderText(/Jump to/i), "Alaric");

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(await screen.findByText("Alaric Stormwind")).toBeDefined();
    expect(screen.queryByText("Beren Thistlewood")).toBeNull();
    expect(screen.queryByText("Ironmark")).toBeNull();
  });

  it("shows an empty state when nothing matches", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: (ms) => {
        vi.advanceTimersByTime(ms);
      },
    });
    renderPalette();

    await screen.findByText("Eastern Marches");
    await user.type(
      screen.getByPlaceholderText(/Jump to/i),
      "no-such-entity-xyz",
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(
      await screen.findByText('No results for "no-such-entity-xyz".'),
    ).toBeDefined();
  });

  it("shows the switch-character action and calls switchTo on select", async () => {
    const switchTo = vi.fn();
    const user = userEvent.setup();
    renderPalette({
      activePlayerCharacter: {
        activeCharacter: createCitizen({ id: "citizen-1" }),
        clear: vi.fn(),
        isPending: false,
        selectableCharacters: [
          createCitizen({ id: "citizen-1", name: "Alaric" }),
          createCitizen({ id: "citizen-2", name: "Beren" }),
        ],
        switchTo,
      },
    });

    await user.click(await screen.findByText("Switch to: Beren"));

    expect(switchTo).toHaveBeenCalledWith("citizen-2");
  });

  it("hides the mark-ready action when not visible", () => {
    useSettlementReadinessActionMock.mockReturnValue({
      isToggleDisabled: false,
      isVisible: false,
      item: null,
      toggle: vi.fn(),
    });
    renderPalette();

    expect(screen.queryByText(/Mark .* ready/)).toBeNull();
  });

  it("shows and triggers the mark-ready action when visible", async () => {
    const toggle = vi.fn();
    useSettlementReadinessActionMock.mockReturnValue({
      isToggleDisabled: false,
      isVisible: true,
      item: {
        autoReadyEnabled: false,
        id: SETTLEMENT_ID,
        isReadyCurrentTurn: false,
        isReadyForCurrentTurn: false,
        lastReadyAt: null,
        name: "Amberhold",
        nationId: NATION_ID,
        nationName: "Ironmark",
        readySetAt: null,
      },
      toggle,
    });
    const user = userEvent.setup();
    renderPalette();

    await user.click(await screen.findByText("Mark Amberhold ready"));

    expect(toggle).toHaveBeenCalled();
  });

  it("shows the end-turn action only for effective admins and bridges to the header button", async () => {
    useAppShellWorldContextMock.mockReturnValue({
      canAdmin: true,
      worldId: WORLD_ID,
    });
    const endTurnClick = vi.fn();
    const user = userEvent.setup();

    const { container } = renderPalette();
    const bridgeButton = document.createElement("button");
    bridgeButton.setAttribute("data-command-palette-action", "end-turn");
    bridgeButton.addEventListener("click", endTurnClick);
    container.append(bridgeButton);

    await user.click(await screen.findByText("End turn"));

    expect(endTurnClick).toHaveBeenCalled();
  });

  it("does not show the end-turn action for non-admins", async () => {
    useAppShellWorldContextMock.mockReturnValue({
      canAdmin: false,
      worldId: WORLD_ID,
    });
    renderPalette();

    await screen.findByText("Amberhold");
    expect(screen.queryByText("End turn")).toBeNull();
  });

  it("always shows the go-to-notifications action", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderPalette({ onOpenChange });

    await user.click(await screen.findByText("Go to notifications"));

    expect(navigateMock).toHaveBeenCalledWith({ to: "/notifications" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows go-to-configuration only for world admins", async () => {
    useAppShellWorldContextMock.mockReturnValue({
      canAdmin: true,
      worldId: WORLD_ID,
    });
    const user = userEvent.setup();
    renderPalette();

    await user.click(await screen.findByText("Go to configuration"));

    expect(navigateMock).toHaveBeenCalledWith({
      params: { worldId: WORLD_ID },
      search: { tab: "resources" },
      to: "/worlds/$worldId/configuration",
    });
  });

  it("hides go-to-configuration for non-admins", async () => {
    useAppShellWorldContextMock.mockReturnValue({
      canAdmin: false,
      worldId: WORLD_ID,
    });
    renderPalette();

    await screen.findByText("Amberhold");
    expect(screen.queryByText("Go to configuration")).toBeNull();
  });
});

function createCitizen(overrides: Partial<Citizen> = {}): Citizen {
  return {
    bornOnTurnNumber: null,
    citizenType: "player_character",
    createdAt: "2026-01-01T00:00:00.000Z",
    deathCause: null,
    deathCauseCategory: null,
    givenName: "Test",
    id: "citizen-x",
    name: "Test Citizen",
    namesetId: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    profilePhotoUrl: null,
    roleNationId: null,
    roleSettlementId: null,
    roleType: "none",
    settlementId: null,
    sex: null,
    status: "alive",
    surname: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    userId: "user-1",
    worldId: WORLD_ID,
    ...overrides,
  } satisfies Citizen;
}

function renderPalette({
  activePlayerCharacter,
  onOpenChange = vi.fn(),
  open = true,
}: {
  readonly activePlayerCharacter?: ActivePlayerCharacterContextValue;
  readonly onOpenChange?: (open: boolean) => void;
  readonly open?: boolean;
} = {}): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const contextValue: ActivePlayerCharacterContextValue =
    activePlayerCharacter ?? {
      activeCharacter: null,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    };

  return render(
    <QueryClientProvider client={queryClient}>
      <ActivePlayerCharacterContext value={contextValue}>
        <CommandPalette onOpenChange={onOpenChange} open={open} />
      </ActivePlayerCharacterContext>
    </QueryClientProvider>,
  );
}
