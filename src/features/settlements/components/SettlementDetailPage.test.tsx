import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivePlayerCharacterContextValue } from "@/features/permissions";

import { SettlementDetailPage } from "./SettlementDetailPage";

import type { ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn<(message: string) => void>(),
  toastSuccess:
    vi.fn<(message: string, options?: { description?: string }) => void>(),
}));
vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

const { useActivePlayerCharacterMock } = vi.hoisted(() => ({
  useActivePlayerCharacterMock: vi.fn<() => ActivePlayerCharacterContextValue>(
    () => ({
      activeCharacter: null,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    }),
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    className,
    asChild: _asChild,
  }: {
    readonly children: ReactNode;
    readonly to: string;
    readonly params?: Readonly<Record<string, string>>;
    readonly className?: string;
    readonly asChild?: boolean;
  }) => {
    const href =
      params === undefined
        ? to
        : Object.entries(params).reduce(
            (path, [name, value]) => path.replace(`$${name}`, value),
            to,
          );
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
  useNavigate: () => navigateMock,
}));

vi.mock("@/features/citizens", async () => {
  const actual = await vi.importActual("@/features/citizens");
  return {
    ...actual,
    CitizensPanel: () => <div data-testid="citizens-panel" />,
  };
});

vi.mock("@/features/buildings", async () => {
  const actual = await vi.importActual("@/features/buildings");
  return {
    ...actual,
    SettlementBuildingsPanel: () => (
      <div data-testid="settlement-buildings-panel" />
    ),
  };
});

vi.mock("@/features/permissions", async () => {
  const actual = await vi.importActual("@/features/permissions");
  return {
    ...actual,
    useActivePlayerCharacter: useActivePlayerCharacterMock,
  };
});

const WORLD_ID = "00000000-0000-0000-0000-000000000010";
const NATION_ID = "00000000-0000-0000-0000-000000000020";
const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000030";
const USER_ID = "00000000-0000-0000-0000-000000000001";

type SettlementWithNationRow = {
  readonly coord_x: number | null;
  readonly coord_z: number | null;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly nation_id: string;
  readonly nations: {
    readonly id: string;
    readonly name: string;
    readonly world_id: string;
  };
  readonly updated_at: string;
};

type SettlementBaseRow = {
  readonly coord_x: number | null;
  readonly coord_z: number | null;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly nation_id: string;
  readonly updated_at: string;
};

type ReadinessRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly last_ready_at: string | null;
  readonly name: string;
  readonly nation_id: string;
  readonly nations: { readonly id: string; readonly name: string };
  readonly ready_set_at: string | null;
};

function createSettlementWithNationRow(
  overrides: Partial<SettlementWithNationRow> = {},
): SettlementWithNationRow {
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
  overrides: Partial<SettlementBaseRow> = {},
): SettlementBaseRow {
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
  overrides: Partial<ReadinessRow> = {},
): ReadinessRow {
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

function createClient({
  adminRows = [],
  readinessRows = [createReadinessRow()],
  settlementRow = createSettlementWithNationRow(),
  settlementUpdateResult = {
    data: createSettlementBaseRow(),
    error: null,
  },
  settlementDeleteResult = {
    data: { id: SETTLEMENT_ID, nation_id: NATION_ID },
    error: null,
  },
  worldOwnerId = USER_ID,
  worldVisibility = "private",
}: {
  readonly adminRows?: ReadonlyArray<{ readonly world_id: string }>;
  readonly readinessRows?: ReadonlyArray<ReadinessRow>;
  readonly settlementRow?: SettlementWithNationRow | null;
  readonly settlementUpdateResult?: {
    readonly data: unknown;
    readonly error: unknown;
  };
  readonly settlementDeleteResult?: {
    readonly data: unknown;
    readonly error: unknown;
  };
  readonly worldOwnerId?: string;
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
    owner_id: worldOwnerId,
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
        owner_id: USER_ID,
        status: "active",
        visibility: "private",
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
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: userRow, error: null }),
            })),
          })),
        };
      }
      if (table === "world_admins") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi
                .fn()
                .mockResolvedValue({ data: adminRows, error: null }),
            })),
          })),
        };
      }
      if (table === "citizens") {
        const b: Record<string, unknown> = {};
        b.eq = vi.fn(() => b);
        b.order = vi.fn().mockResolvedValue({ data: [], error: null });
        return { select: vi.fn(() => b) };
      }
      if (table === "worlds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: worldRow, error: null }),
            })),
            order: vi.fn().mockResolvedValue({ data: [worldRow], error: null }),
          })),
        };
      }
      if (table === "settlements") {
        return {
          delete: vi.fn(() => deleteChain),
          select: vi.fn((columns: string) => {
            if (columns.includes("description")) {
              const b: Record<string, unknown> = {};
              b.eq = vi.fn(() => b);
              b.maybeSingle = vi
                .fn()
                .mockResolvedValue({ data: settlementRow, error: null });
              return b;
            }
            if (columns.includes("auto_ready_enabled")) {
              const b: Record<string, unknown> = {};
              b.eq = vi.fn(() => b);
              b.order = vi.fn(() => b);
              b.returns = vi
                .fn()
                .mockResolvedValue({ data: readinessRows, error: null });
              return b;
            }
            if (columns.includes("worlds!inner")) {
              const b: Record<string, unknown> = {};
              b.eq = vi.fn(() => b);
              b.maybeSingle = vi
                .fn()
                .mockResolvedValue({ data: settlementAccessRow, error: null });
              return b;
            }
            throw new Error(`Unexpected settlement select columns: ${columns}`);
          }),
          update: vi.fn(() => updateChain),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn((fn: string) => {
      throw new Error(`Unexpected RPC call: ${fn}`);
    }),
  };
}

describe("SettlementDetailPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    navigateMock.mockReset();
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
  });

  it("renders the loading state while the access context query is pending", () => {
    requireSupabaseClient.mockReturnValue({
      auth: { getSession: vi.fn(() => new Promise<never>(() => {})) },
      from: vi.fn(),
    });
    renderPage();
    expect(screen.getByText("Loading world access…")).toBeDefined();
  });

  it("renders the world-unavailable state when the world cannot be accessed", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ worldOwnerId: "other-user", worldVisibility: "private" }),
    );
    renderPage();
    expect(await screen.findByText("World unavailable")).toBeDefined();
  });

  it("renders the settlement-unavailable state when the settlement does not exist", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        settlementRow: null,
      }),
    );
    renderPage();
    expect(await screen.findByText("Settlement unavailable")).toBeDefined();
  });

  it("renders the settlement name, back link, and citizens panel for an admin viewer", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ adminRows: [{ world_id: WORLD_ID }] }),
    );
    renderPage();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Hometown" }),
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Back to Homeland" }),
    ).toHaveAttribute("href", `/worlds/${WORLD_ID}/nations/${NATION_ID}`);
    expect(screen.getByTestId("citizens-panel")).toBeDefined();
  });

  it("shows edit and delete controls for admin viewers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ adminRows: [{ world_id: WORLD_ID }] }),
    );
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Hometown" });
    expect(
      screen.getAllByRole("button", { name: "Edit" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Delete settlement" }),
    ).toBeDefined();
  });

  it("hides edit and delete controls from non-admin viewers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ worldOwnerId: "other-user", worldVisibility: "public" }),
    );
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Hometown" });
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Delete settlement" }),
    ).toBeNull();
  });

  it("submits the edit-details form and closes the editor on success", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ adminRows: [{ world_id: WORLD_ID }] }),
    );
    renderPage();

    const [detailsEditBtn] = await screen.findAllByRole("button", {
      name: "Edit",
    });
    await userEvent.click(detailsEditBtn);

    expect(
      screen.getByRole("form", { name: "Edit settlement details" }),
    ).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

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
    renderPage();

    const [detailsEditBtn] = await screen.findAllByRole("button", {
      name: "Edit",
    });
    await userEvent.click(detailsEditBtn);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("Update failed"),
      );
    });
    expect(
      screen.getByRole("form", { name: "Edit settlement details" }),
    ).toBeDefined();
  });

  it("fires the set-readiness mutation when the manual readiness toggle is clicked", async () => {
    const rpcMock = vi.fn((fn: string, params: Record<string, unknown>) => {
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
      throw new Error(`Unexpected RPC: ${fn}`);
    });
    const client = createClient({ adminRows: [{ world_id: WORLD_ID }] });
    (client as Record<string, unknown>).rpc = rpcMock;
    requireSupabaseClient.mockReturnValue(client);

    renderPage();

    const readinessToggle = await screen.findByRole("switch", {
      name: "Not ready",
    });
    await userEvent.click(readinessToggle);

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "set_settlement_readiness",
        expect.objectContaining({ p_settlement_id: SETTLEMENT_ID }),
      );
    });
  });

  it("fires the set-auto-ready mutation when the auto-ready toggle is clicked", async () => {
    const rpcMock = vi.fn((fn: string, params: Record<string, unknown>) => {
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
      throw new Error(`Unexpected RPC: ${fn}`);
    });
    const client = createClient({ adminRows: [{ world_id: WORLD_ID }] });
    (client as Record<string, unknown>).rpc = rpcMock;
    requireSupabaseClient.mockReturnValue(client);

    renderPage();

    const autoReadyToggle = await screen.findByRole("switch", {
      name: "Auto-ready",
    });
    await userEvent.click(autoReadyToggle);

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "set_settlement_auto_ready",
        expect.objectContaining({ p_settlement_id: SETTLEMENT_ID }),
      );
    });
  });

  it("shows the delete confirmation dialog and navigates to the nation page on success", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ adminRows: [{ world_id: WORLD_ID }] }),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Delete settlement" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(screen.getByText(/Are you sure you want to delete/)).toBeDefined();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete settlement" }),
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        params: { nationId: NATION_ID, worldId: WORLD_ID },
        replace: true,
        to: "/worlds/$worldId/nations/$nationId",
      });
    });
    expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
      "Settlement deleted.",
      undefined,
    );
  });
});

function renderPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SettlementDetailPage
        assignmentTab="bulk"
        nationId={NATION_ID}
        settlementId={SETTLEMENT_ID}
        worldId={WORLD_ID}
      />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}
