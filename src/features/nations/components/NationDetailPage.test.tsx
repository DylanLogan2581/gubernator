import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivePlayerCharacterContextValue } from "@/features/permissions";

import { NationDetailPage } from "./NationDetailPage";
import { useNationDetailContext } from "./NationDetailPage/NationDetailContext";

import type { JSX, ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
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
  useNavigate: () => navigateMock,
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

vi.mock("@/features/permissions", async () => {
  const actual = await vi.importActual("@/features/permissions");
  return {
    ...actual,
    useActivePlayerCharacter: useActivePlayerCharacterMock,
    useEffectiveCanAdmin: (canAdmin: boolean) => {
      const { activeCharacter } = useActivePlayerCharacterMock();
      return canAdmin && activeCharacter === null;
    },
  };
});

const WORLD_ID = "00000000-0000-0000-0000-000000000101";
const NATION_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "00000000-0000-0000-0000-000000000001";

type TestNationRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly is_hidden: boolean;
  readonly name: string;
  readonly nameset_id: string | null;
  readonly updated_at: string;
  readonly world_id: string;
};

type TestWorldRow = {
  readonly archived_at: string | null;
  readonly calendar_config_json: unknown;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
};

function createCalendarConfig(): unknown {
  return {
    dateFormatTemplate: "{weekday}, {month} {day}, {year} AG",
    months: [
      { dayCount: 2, index: 0, name: "Dawn" },
      { dayCount: 3, index: 1, name: "Ember" },
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

function createWorldRow(overrides: Partial<TestWorldRow> = {}): TestWorldRow {
  return {
    archived_at: null,
    calendar_config_json: createCalendarConfig(),
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 1,
    id: WORLD_ID,
    name: "World",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "private",
    ...overrides,
  };
}

function createNationRow(
  overrides: Partial<TestNationRow> = {},
): TestNationRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    description: null,
    id: NATION_ID,
    is_hidden: false,
    name: "Nation",
    nameset_id: null,
    updated_at: "2026-01-02T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createUser(id: string, isSuperAdmin = false): unknown {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    email: `${id}@example.com`,
    id,
    is_super_admin: isSuperAdmin,
    status: "active",
    updated_at: "2026-01-01T00:00:00.000Z",
    username: id,
  };
}

function createClient({
  adminRows = [],
  isSuperAdmin = false,
  nationRows,
  session,
  worldRows,
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly isSuperAdmin?: boolean;
  readonly nationRows: readonly TestNationRow[];
  readonly session: { readonly user: { readonly id: string } };
  readonly worldRows: readonly TestWorldRow[];
}): unknown {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: createUser(session.user.id, isSuperAdmin),
                error: null,
              }),
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
      if (table === "worlds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: string, value: string) => {
              const data =
                column === "id"
                  ? (worldRows.find((row) => row.id === value) ?? null)
                  : null;
              return {
                maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
              };
            }),
            order: vi.fn().mockResolvedValue({ data: worldRows, error: null }),
          })),
        };
      }
      if (table === "nations") {
        const listBuilder = {
          eq: vi.fn(() => listBuilder),
          order: vi.fn(() => listBuilder),
          returns: vi.fn().mockResolvedValue({ data: nationRows, error: null }),
        };
        return {
          select: vi.fn(() => ({
            ...listBuilder,
            eq: vi.fn((column: string, value: string) => {
              if (column === "id") {
                const row =
                  nationRows.find((candidate) => candidate.id === value) ??
                  null;
                return {
                  maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: row, error: null }),
                };
              }
              return listBuilder;
            }),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn((fn: string) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: [], error: null });
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    }),
  };
}

// Renders the nation detail context values as text so tests can assert on
// the computed permission booleans without depending on any particular
// child route's markup — those now live in the section route files.
function ContextProbe(): JSX.Element {
  const {
    canDelete,
    canEditDetails,
    canToggleHidden,
    effectiveCanAdmin,
    isArchived,
    nation,
    worldAccess,
  } = useNationDetailContext();

  return (
    <dl>
      <dt>canDelete</dt>
      <dd>{String(canDelete)}</dd>
      <dt>canEditDetails</dt>
      <dd>{String(canEditDetails)}</dd>
      <dt>canToggleHidden</dt>
      <dd>{String(canToggleHidden)}</dd>
      <dt>effectiveCanAdmin</dt>
      <dd>{String(effectiveCanAdmin)}</dd>
      <dt>isArchived</dt>
      <dd>{String(isArchived)}</dd>
      <dt>nationId</dt>
      <dd>{nation.id}</dd>
      <dt>worldAccessCanAdmin</dt>
      <dd>{String(worldAccess.canAdmin)}</dd>
    </dl>
  );
}

describe("NationDetailPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    navigateMock.mockReset();
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
      createClient({
        nationRows: [createNationRow()],
        session: { user: { id: USER_ID } },
        worldRows: [],
      }),
    );
    renderPage();
    expect(await screen.findByText("World unavailable")).toBeDefined();
  });

  it("renders the nation-unavailable state when the nation does not exist", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        nationRows: [],
        session: { user: { id: USER_ID } },
        worldRows: [createWorldRow()],
      }),
    );
    renderPage();
    expect(await screen.findByText("Nation unavailable")).toBeDefined();
  });

  it("renders nation name, subtitle, and back link once loaded", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        nationRows: [
          createNationRow({
            description: "A mountain realm.",
            name: "Highmark",
          }),
        ],
        session: { user: { id: USER_ID } },
        worldRows: [createWorldRow()],
      }),
    );
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Highmark" }),
    ).toBeDefined();
    expect(screen.getByText(/Nation in/)).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Back to nations" }),
    ).toHaveAttribute("href", `/worlds/${WORLD_ID}/nations`);
  });

  it("renders children once the nation and world access resolve", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        nationRows: [createNationRow()],
        session: { user: { id: USER_ID } },
        worldRows: [createWorldRow()],
      }),
    );
    renderPage();
    expect(await screen.findByText("nationId")).toBeDefined();
  });

  it("exposes full edit/toggle/delete authority to admin viewers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        nationRows: [createNationRow()],
        session: { user: { id: USER_ID } },
        worldRows: [createWorldRow()],
      }),
    );
    renderPage();
    await screen.findByText("nationId");

    expect(
      screen.getByText("canEditDetails").nextElementSibling,
    ).toHaveTextContent("true");
    expect(
      screen.getByText("canToggleHidden").nextElementSibling,
    ).toHaveTextContent("true");
    expect(screen.getByText("canDelete").nextElementSibling).toHaveTextContent(
      "true",
    );
    expect(
      screen.getByText("effectiveCanAdmin").nextElementSibling,
    ).toHaveTextContent("true");
  });

  it("hides edit/toggle/delete authority from plain viewers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [createNationRow()],
        session: { user: { id: "user-2" } },
        worldRows: [createWorldRow({ visibility: "public" })],
      }),
    );
    renderPage();
    await screen.findByText("nationId");

    expect(
      screen.getByText("canEditDetails").nextElementSibling,
    ).toHaveTextContent("false");
    expect(
      screen.getByText("canToggleHidden").nextElementSibling,
    ).toHaveTextContent("false");
    expect(screen.getByText("canDelete").nextElementSibling).toHaveTextContent(
      "false",
    );
  });

  it("suppresses admin authority (but keeps worldAccess.canAdmin) when the viewer has an active character", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        nationRows: [createNationRow()],
        session: { user: { id: USER_ID } },
        worldRows: [createWorldRow()],
      }),
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
    renderPage();
    await screen.findByText("nationId");

    expect(
      screen.getByText("effectiveCanAdmin").nextElementSibling,
    ).toHaveTextContent("false");
    expect(
      screen.getByText("worldAccessCanAdmin").nextElementSibling,
    ).toHaveTextContent("true");
  });

  it("marks the nation archived and revokes edit/toggle/delete authority when the world is archived", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        nationRows: [createNationRow()],
        session: { user: { id: USER_ID } },
        worldRows: [
          createWorldRow({
            archived_at: "2026-06-01T00:00:00.000Z",
            status: "archived",
          }),
        ],
      }),
    );
    renderPage();
    await screen.findByText("nationId");

    expect(screen.getByText("isArchived").nextElementSibling).toHaveTextContent(
      "true",
    );
    expect(
      screen.getByText("canEditDetails").nextElementSibling,
    ).toHaveTextContent("false");
    expect(screen.getByText("canDelete").nextElementSibling).toHaveTextContent(
      "false",
    );
  });

  it("redirects out when the nation is hidden and the viewer cannot manage the world", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        nationRows: [createNationRow({ is_hidden: true, name: "Veilreach" })],
        session: { user: { id: "user-2" } },
        worldRows: [createWorldRow({ visibility: "public" })],
      }),
    );
    renderPage();

    await screen.findByRole("status", { name: "Redirecting…" });
    expect(navigateMock).toHaveBeenCalledWith({
      params: { worldId: WORLD_ID },
      replace: true,
      to: "/worlds/$worldId/nations",
    });
    expect(screen.queryByRole("heading", { name: "Veilreach" })).toBeNull();
  });

  it("shows the hidden badge to world admins viewing a hidden nation", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        nationRows: [createNationRow({ is_hidden: true, name: "Veilreach" })],
        session: { user: { id: USER_ID } },
        worldRows: [createWorldRow()],
      }),
    );
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Veilreach" }),
    ).toBeDefined();
    expect(screen.getByText("Hidden")).toBeDefined();
  });
});

function renderPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <NationDetailPage nationId={NATION_ID} worldId={WORLD_ID}>
        <ContextProbe />
      </NationDetailPage>
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}
