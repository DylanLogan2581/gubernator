import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivePlayerCharacterContextValue } from "@/features/permissions";
import { routeTree } from "@/routeTree.gen";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
  supabase: null,
}));

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn<(message: string) => void>(),
  toastSuccess:
    vi.fn<(message: string, options?: { description?: string }) => void>(),
}));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
  Toaster: () => null,
}));

const { useActivePlayerCharacterMock, useSettlementManageAuthorityMock } =
  vi.hoisted(() => ({
    useActivePlayerCharacterMock: vi.fn<
      () => ActivePlayerCharacterContextValue
    >(() => ({
      activeCharacter: null,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    })),
    useSettlementManageAuthorityMock: vi.fn(() => ({
      canManageSettlement: true,
      canManageNation: true,
    })),
  }));

// Mocked at the leaf-hook file level (not the "@/features/permissions"
// barrel) because that barrel re-exports files with a real circular import
// back into "@/features/settlements" (activePlayerCharacterMutations.ts,
// PlayerCharacterChooser.tsx, etc.) — mocking the whole barrel via
// `vi.importActual` mid-cycle left some import sites (this file's own
// settlements feature code) still bound to the real, unmocked hooks while
// others (AppSidebar) saw the mock. Mocking the specific hook modules avoids
// re-entering that cycle entirely.
vi.mock(
  "@/features/permissions/context/activePlayerCharacterContext",
  async () => {
    const actual = await vi.importActual(
      "@/features/permissions/context/activePlayerCharacterContext",
    );
    return {
      ...actual,
      useActivePlayerCharacter: useActivePlayerCharacterMock,
    };
  },
);
vi.mock("@/features/permissions/hooks/useEffectiveCanAdmin", () => ({
  useEffectiveCanAdmin: (canAdmin: boolean) => {
    const { activeCharacter } = useActivePlayerCharacterMock();
    return canAdmin && activeCharacter === null;
  },
}));
vi.mock("@/features/permissions/hooks/useSettlementManageAuthority", () => ({
  useSettlementManageAuthority: useSettlementManageAuthorityMock,
}));

// The section routes compose real, heavier feature panels — they're stubbed
// here so this suite stays focused on routing/composition (redirects, which
// child renders at which URL, permission plumbing into the shared context)
// rather than re-verifying each panel's own behavior, which is unchanged and
// covered by that panel's own tests.
vi.mock("@/features/citizens", async () => {
  const actual = await vi.importActual("@/features/citizens");
  return {
    ...actual,
    CitizensPanel: () => <div data-testid="citizens-panel" />,
    SettlementAssignmentBoard: (props: Record<string, unknown>) => (
      <div data-testid="assignment-board" data-props={JSON.stringify(props)} />
    ),
  };
});
vi.mock("@/features/managed-populations", async () => {
  const actual = await vi.importActual("@/features/managed-populations");
  return {
    ...actual,
    SettlementManagedPopulationsPanel: () => (
      <div data-testid="managed-populations-panel" />
    ),
  };
});
vi.mock("@/features/buildings", async () => {
  const actual = await vi.importActual("@/features/buildings");
  return {
    ...actual,
    SettlementBuildingsPanel: () => <div data-testid="buildings-panel" />,
  };
});
vi.mock("@/features/construction", async () => {
  const actual = await vi.importActual("@/features/construction");
  return {
    ...actual,
    SettlementConstructionPanel: () => <div data-testid="construction-panel" />,
  };
});
vi.mock("@/features/resources", async () => {
  const actual = await vi.importActual("@/features/resources");
  return {
    ...actual,
    SettlementStockpilesPanel: () => <div data-testid="stockpiles-panel" />,
  };
});
vi.mock("@/features/deposits", async () => {
  const actual = await vi.importActual("@/features/deposits");
  return {
    ...actual,
    SettlementDepositsPanel: () => <div data-testid="deposits-panel" />,
  };
});
vi.mock("@/features/trade", async () => {
  const actual = await vi.importActual("@/features/trade");
  return {
    ...actual,
    SettlementTradeRoutesPanel: () => <div data-testid="trade-panel" />,
  };
});
vi.mock("@/features/reports", async () => {
  const actual = await vi.importActual("@/features/reports");
  return {
    ...actual,
    SettlementReportsPanel: () => <div data-testid="reports-panel" />,
  };
});
vi.mock("@/features/turns", async () => {
  const actual = await vi.importActual("@/features/turns");
  return {
    ...actual,
    TurnLogBrowser: () => <div data-testid="turn-log-browser" />,
    TurnTransitionOutcomePanel: () => (
      <div data-testid="turn-transition-outcome-panel" />
    ),
  };
});
vi.mock("@/features/events", async () => {
  const actual = await vi.importActual("@/features/events");
  return {
    ...actual,
    ActiveEventsCard: () => <div data-testid="active-events-card" />,
  };
});
vi.mock("@/features/namesets", async () => {
  const actual = await vi.importActual("@/features/namesets");
  return {
    ...actual,
    SettlementNamesetCard: () => <div data-testid="nameset-card" />,
  };
});

const WORLD_ID = "00000000-0000-0000-0000-000000000010";
const NATION_ID = "00000000-0000-0000-0000-000000000020";
const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000030";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const BASE_PATH = `/worlds/${WORLD_ID}/nations/${NATION_ID}/settlements/${SETTLEMENT_ID}`;

type TestRouter = {
  readonly state: {
    readonly location: {
      readonly pathname: string;
      readonly search: unknown;
    };
  };
};

// A self-referencing, thenable Supabase query-chain stub: `.eq()`/`.order()`
// keep returning the same builder so any call sequence chains, and the
// builder is itself awaitable (`await builder` resolves `result`) so a chain
// that ends on `.eq()`/`.order()` (no explicit `.maybeSingle()`/`.returns()`)
// still resolves correctly instead of silently `await`-ing a plain object.
function chainBuilder(result: unknown): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.single = vi.fn().mockResolvedValue(result);
  builder.returns = vi.fn().mockResolvedValue(result);
  builder.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

function createClient({
  adminRows = [],
  readinessRows = [createReadinessRow()],
  settlementRow = createSettlementWithNationRow(),
  settlementUpdateResult = { data: createSettlementBaseRow(), error: null },
  settlementDeleteResult = {
    data: { id: SETTLEMENT_ID, nation_id: NATION_ID },
    error: null,
  },
  worldVisibility = "private",
}: {
  readonly adminRows?: ReadonlyArray<{ readonly world_id: string }>;
  readonly readinessRows?: readonly unknown[];
  readonly settlementRow?: unknown;
  readonly settlementUpdateResult?: {
    readonly data: unknown;
    readonly error: unknown;
  };
  readonly settlementDeleteResult?: {
    readonly data: unknown;
    readonly error: unknown;
  };
  readonly worldVisibility?: string;
} = {}): unknown {
  const worldRow = {
    archived_at: null,
    calendar_config_json: createCalendarConfig(),
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 3,
    id: WORLD_ID,
    incest_prevention_depth: 4,
    name: "Test World",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: worldVisibility,
  };

  const userRow = {
    created_at: "2026-01-01T00:00:00.000Z",
    email: "user@example.com",
    id: USER_ID,
    is_super_admin: false,
    status: "active",
    updated_at: "2026-01-01T00:00:00.000Z",
    username: "testuser",
  };

  const settlementAccessRow = {
    id: SETTLEMENT_ID,
    nations: {
      world_id: WORLD_ID,
      worlds: {
        archived_at: null,
        id: WORLD_ID,
        status: "active",
        visibility: worldVisibility,
      },
    },
  };

  const updateChain: Record<string, unknown> = {};
  updateChain.eq = vi.fn(() => updateChain);
  updateChain.select = vi.fn(() => ({
    single: vi.fn().mockResolvedValue(settlementUpdateResult),
  }));

  const deleteChain: Record<string, unknown> = {};
  deleteChain.eq = vi.fn(() => deleteChain);
  deleteChain.select = vi.fn(() => ({
    maybeSingle: vi.fn().mockResolvedValue(settlementDeleteResult),
  }));

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: USER_ID } } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => chainBuilder({ data: userRow, error: null })),
        };
      }
      if (table === "world_admins") {
        return {
          select: vi.fn(() => chainBuilder({ data: adminRows, error: null })),
        };
      }
      if (table === "worlds") {
        return {
          select: vi.fn(() => chainBuilder({ data: worldRow, error: null })),
        };
      }
      if (table === "nations") {
        return { select: vi.fn(() => chainBuilder({ data: [], error: null })) };
      }
      if (table === "notifications") {
        const chain: Record<string, unknown> = {};
        chain.eq = vi
          .fn()
          .mockResolvedValue({ count: 0, data: [], error: null });
        chain.order = vi.fn(() => chain);
        chain.range = vi.fn(() => chain);
        return { select: vi.fn(() => ({ eq: vi.fn(() => chain) })) };
      }
      if (table === "citizens") {
        return { select: vi.fn(() => chainBuilder({ data: [], error: null })) };
      }
      if (table === "user_active_player_characters") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              })),
            })),
          })),
        };
      }
      if (table === "settlements") {
        return {
          delete: vi.fn(() => deleteChain),
          select: vi.fn((columns: string) => {
            if (columns.includes("description")) {
              return chainBuilder({ data: settlementRow, error: null });
            }
            if (columns.includes("auto_ready_enabled")) {
              return chainBuilder({ data: readinessRows, error: null });
            }
            if (columns.includes("worlds!inner")) {
              return chainBuilder({ data: settlementAccessRow, error: null });
            }
            if (columns.includes("nations!inner")) {
              return chainBuilder({ data: [], error: null });
            }
            throw new Error(`Unexpected settlement select columns: ${columns}`);
          }),
          update: vi.fn(() => updateChain),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({}) }),
    }),
    removeChannel: vi.fn().mockResolvedValue("ok"),
    rpc: vi.fn((fn: string, params: Record<string, unknown> = {}) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: [], error: null });
      }
      if (fn === "set_settlement_readiness") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: SETTLEMENT_ID,
              is_ready_current_turn: params.p_is_ready,
              last_ready_at: null,
              ready_set_at: null,
            },
            error: null,
          }),
        };
      }
      if (fn === "set_settlement_auto_ready") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              auto_ready_enabled: params.p_auto_ready_enabled,
              id: SETTLEMENT_ID,
              is_ready_current_turn: false,
              ready_set_at: null,
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC call: ${fn}`);
    }),
  };
}

function createSettlementWithNationRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    coord_x: null,
    coord_z: null,
    created_at: "2026-05-01T00:00:00.000Z",
    description: null,
    id: SETTLEMENT_ID,
    name: "Hometown",
    nation_id: NATION_ID,
    nations: { id: NATION_ID, name: "Homeland", world_id: WORLD_ID },
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function createSettlementBaseRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    coord_x: null,
    coord_z: null,
    created_at: "2026-05-01T00:00:00.000Z",
    description: null,
    id: SETTLEMENT_ID,
    name: "Hometown",
    nation_id: NATION_ID,
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function createReadinessRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    auto_ready_enabled: false,
    id: SETTLEMENT_ID,
    is_ready_current_turn: false,
    last_ready_at: null,
    name: "Hometown",
    nation_id: NATION_ID,
    nations: { id: NATION_ID, name: "Homeland" },
    ready_set_at: null,
    ...overrides,
  };
}

function createCalendarConfig(): unknown {
  return {
    dateFormatTemplate: "{weekday}, {month} {day}, {year} AG",
    months: [
      { dayCount: 30, index: 0, name: "Dawn" },
      { dayCount: 30, index: 1, name: "Ember" },
    ],
    startingDayOfMonth: 1,
    startingMonthIndex: 0,
    startingWeekdayOffset: 0,
    startingYear: 100,
    weekdays: [
      { index: 0, name: "Firstday" },
      { index: 1, name: "Secondday" },
    ],
  };
}

function renderAt(path: string): TestRouter {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const router = createRouter({
    defaultPendingMs: 0,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
    routeTree,
  });

  render(<RouterProvider router={router} />);

  return router;
}

describe("settlement detail route", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    useActivePlayerCharacterMock.mockReset();
    useActivePlayerCharacterMock.mockReturnValue({
      activeCharacter: null,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    });
    useSettlementManageAuthorityMock.mockReset();
    useSettlementManageAuthorityMock.mockReturnValue({
      canManageSettlement: true,
      canManageNation: true,
    });
  });

  describe("legacy ?section= redirects", () => {
    const CASES: ReadonlyArray<readonly [string, string]> = [
      ["overview", BASE_PATH],
      ["population", `${BASE_PATH}/citizens`],
      ["economy", `${BASE_PATH}/buildings`],
      ["forecast", `${BASE_PATH}/forecast`],
      ["reports", `${BASE_PATH}/reports`],
      ["history", `${BASE_PATH}/history`],
      ["admin", `${BASE_PATH}/settings`],
    ];

    it.each(CASES)("?section=%s redirects to %s", async (section, target) => {
      requireSupabaseClient.mockReturnValue(
        createClient({ adminRows: [{ world_id: WORLD_ID }] }),
      );
      const router = renderAt(`${BASE_PATH}?section=${section}`);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(target);
      });
      expect(router.state.location.search).not.toHaveProperty("section");
    });

    it("drops a stray ?assignmentTab= without affecting the redirect", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({ adminRows: [{ world_id: WORLD_ID }] }),
      );
      const router = renderAt(
        `${BASE_PATH}?section=population&assignmentTab=per-target`,
      );

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`${BASE_PATH}/citizens`);
      });
    });
  });

  describe("section reachability", () => {
    it("renders the overview at the base URL", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({ adminRows: [{ world_id: WORLD_ID }] }),
      );
      renderAt(BASE_PATH);
      expect(
        await screen.findByRole("heading", { level: 1, name: "Hometown" }),
      ).toBeDefined();
      expect(screen.getByTestId("turn-transition-outcome-panel")).toBeDefined();
      expect(screen.getByTestId("active-events-card")).toBeDefined();
    });

    it("renders the citizens panel at /citizens", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({ adminRows: [{ world_id: WORLD_ID }] }),
      );
      renderAt(`${BASE_PATH}/citizens`);
      await screen.findByRole("heading", { level: 1, name: "Hometown" });

      expect(screen.getByTestId("citizens-panel")).toBeDefined();
      expect(screen.queryByTestId("assignment-board")).toBeNull();
    });

    it("renders the assignment board at /assignments without the removed activeTab prop", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({ adminRows: [{ world_id: WORLD_ID }] }),
      );
      renderAt(`${BASE_PATH}/assignments`);
      await screen.findByRole("heading", { level: 1, name: "Hometown" });

      const board = screen.getByTestId("assignment-board");
      const props = JSON.parse(board.dataset.props ?? "{}") as Record<
        string,
        unknown
      >;
      expect(props).not.toHaveProperty("activeTab");
    });

    const PANEL_CASES: ReadonlyArray<readonly [string, string]> = [
      ["populations", "managed-populations-panel"],
      ["buildings", "buildings-panel"],
      ["construction", "construction-panel"],
      ["stockpiles", "stockpiles-panel"],
      ["deposits", "deposits-panel"],
      ["trade", "trade-panel"],
      ["reports", "reports-panel"],
      ["history", "turn-log-browser"],
    ];

    it.each(PANEL_CASES)(
      "renders the %s panel at its own URL",
      async (segment, testId) => {
        requireSupabaseClient.mockReturnValue(
          createClient({ adminRows: [{ world_id: WORLD_ID }] }),
        );
        renderAt(`${BASE_PATH}/${segment}`);
        await screen.findByRole("heading", { level: 1, name: "Hometown" });
        expect(screen.getByTestId(testId)).toBeDefined();
      },
    );

    it("renders the forecast panel at /forecast", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({ adminRows: [{ world_id: WORLD_ID }] }),
      );
      renderAt(`${BASE_PATH}/forecast`);
      await screen.findByRole("heading", { level: 1, name: "Hometown" });
      expect(await screen.findByText(/forecast/i)).toBeDefined();
    });

    it("renders the nameset card + delete section for admins at /settings", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({ adminRows: [{ world_id: WORLD_ID }] }),
      );
      renderAt(`${BASE_PATH}/settings`);
      await screen.findByRole("heading", { level: 1, name: "Hometown" });
      expect(screen.getByTestId("nameset-card")).toBeDefined();
      expect(
        screen.getByRole("button", { name: "Delete settlement" }),
      ).toBeDefined();
    });

    it("shows the admin-suppressed notice at /settings when an admin has an active character", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({ adminRows: [{ world_id: WORLD_ID }] }),
      );
      useActivePlayerCharacterMock.mockReturnValue({
        activeCharacter: {
          id: "char-1",
          name: "Aria",
          roleType: "none",
          status: "alive",
        } as never,
        clear: vi.fn(),
        isPending: false,
        selectableCharacters: [],
        switchTo: vi.fn(),
      });
      renderAt(`${BASE_PATH}/settings`);
      await screen.findByRole("heading", { level: 1, name: "Hometown" });
      expect(screen.getByText("Admin access paused")).toBeDefined();
      expect(
        screen.queryByRole("button", { name: "Delete settlement" }),
      ).toBeNull();
    });
  });

  describe("overview mutations", () => {
    it("submits the edit-details form and closes the editor on success", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({ adminRows: [{ world_id: WORLD_ID }] }),
      );
      renderAt(BASE_PATH);

      const [detailsEditBtn] = await screen.findAllByRole("button", {
        name: "Edit",
      });
      await userEvent.click(detailsEditBtn);
      expect(
        screen.getByRole("form", { name: "Edit settlement details" }),
      ).toBeDefined();

      await userEvent.click(
        screen.getByRole("button", { name: "Save changes" }),
      );

      await waitFor(() => {
        expect(
          screen.queryByRole("form", { name: "Edit settlement details" }),
        ).toBeNull();
      });
    });

    it("emits an error toast when the details update fails", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          adminRows: [{ world_id: WORLD_ID }],
          settlementUpdateResult: {
            data: null,
            error: { message: "Update failed" },
          },
        }),
      );
      renderAt(BASE_PATH);

      const [detailsEditBtn] = await screen.findAllByRole("button", {
        name: "Edit",
      });
      await userEvent.click(detailsEditBtn);
      await userEvent.click(
        screen.getByRole("button", { name: "Save changes" }),
      );

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith(
          expect.stringContaining("Update failed"),
        );
      });
    });

    it("fires the set-readiness mutation when the manual readiness toggle is clicked", async () => {
      const client = createClient({ adminRows: [{ world_id: WORLD_ID }] });
      requireSupabaseClient.mockReturnValue(client);
      renderAt(BASE_PATH);

      const readinessToggle = await screen.findByRole("switch", {
        name: "Ready",
      });
      await userEvent.click(readinessToggle);

      await waitFor(() => {
        expect(
          (client as { rpc: ReturnType<typeof vi.fn> }).rpc,
        ).toHaveBeenCalledWith(
          "set_settlement_readiness",
          expect.objectContaining({ p_settlement_id: SETTLEMENT_ID }),
        );
      });
    });

    it("hides the coordinate edit button from nation manager viewers", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({ worldVisibility: "public" }),
      );
      const nationManagerCharacter = {
        id: "char-1",
        name: "Riven",
        roleType: "nation_manager",
        roleNationId: NATION_ID,
        status: "alive",
      } as never;
      useActivePlayerCharacterMock.mockReturnValue({
        activeCharacter: nationManagerCharacter,
        clear: vi.fn(),
        isPending: false,
        selectableCharacters: [nationManagerCharacter],
        switchTo: vi.fn(),
      });
      renderAt(BASE_PATH);
      await screen.findByRole("heading", { level: 1, name: "Hometown" });

      const editButtons = await screen.findAllByRole("button", {
        name: "Edit",
      });
      expect(editButtons.length).toBe(1);
    });
  });

  describe("settings mutations", () => {
    it("shows the delete confirmation dialog and navigates to the nation page on success", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({ adminRows: [{ world_id: WORLD_ID }] }),
      );
      const router = renderAt(`${BASE_PATH}/settings`);

      const deleteBtn = await screen.findByRole("button", {
        name: "Delete settlement",
      });
      await userEvent.click(deleteBtn);

      const dialog = await screen.findByRole("alertdialog");
      const confirmBtn = within(dialog).getByRole("button", {
        name: "Delete settlement",
      });
      await userEvent.click(confirmBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          `/worlds/${WORLD_ID}/nations/${NATION_ID}`,
        );
      });
    });
  });
});
