import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

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

// Mocked at the leaf-hook file level (not the "@/features/permissions"
// barrel) — mirrors the settlement route test's approach, which found that
// mocking the whole barrel mid-cycle left some import sites bound to the
// real hook while others saw the mock.
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

// The section routes compose real, heavier cross-feature panels — stubbed
// here so this suite stays focused on routing/composition (redirects, which
// child renders at which URL, permission plumbing into the shared context)
// rather than re-verifying each panel's own behavior, which is unchanged and
// covered by that panel's own tests. Same-feature nation sections
// (details/hidden-toggle/delete/settlements/relationships/role-assignment)
// render for real.
vi.mock("@/features/events", async () => {
  const actual = await vi.importActual("@/features/events");
  return {
    ...actual,
    ActiveEventsCard: () => <div data-testid="active-events-card" />,
  };
});
vi.mock("@/features/turns", async () => {
  const actual = await vi.importActual("@/features/turns");
  return {
    ...actual,
    TurnLogBrowser: () => <div data-testid="turn-log-browser" />,
  };
});
vi.mock("@/features/namesets", async () => {
  const actual = await vi.importActual("@/features/namesets");
  return {
    ...actual,
    NationNamesetCard: () => <div data-testid="nameset-card" />,
  };
});

const WORLD_ID = "00000000-0000-0000-0000-000000000101";
const NATION_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_NATION_ID = "22222222-2222-2222-2222-222222222222";
const SETTLEMENT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "00000000-0000-0000-0000-000000000001";
const BASE_PATH = `/worlds/${WORLD_ID}/nations/${NATION_ID}`;

// A plain player character (no admin/manager role) — WorldEntryGate only
// lets a non-admin viewer past the world gate once they have at least one
// selectable player character.
const PLAIN_CHARACTER = {
  id: "char-plain-1",
  name: "Sela",
  roleType: "none",
  status: "alive",
} as never;

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

type TestSettlementRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly last_ready_at: string | null;
  readonly name: string;
  readonly nation_id: string;
  readonly nations: { readonly name: string };
  readonly ready_set_at: string | null;
};

type TestRelationshipRow = {
  readonly created_at: string;
  readonly current_stance: string;
  readonly from_nation_id: string;
  readonly id: string;
  readonly pending_changed_by_citizen_id: string | null;
  readonly pending_stance: string | null;
  readonly pending_status: string | null;
  readonly to_nation_id: string;
  readonly updated_at: string;
};

type NationDeleteResult = {
  readonly data: { readonly id: string; readonly world_id: string } | null;
  readonly error: { readonly message: string } | null;
};

type UpsertMock = Mock<
  (
    values: Record<string, unknown>,
    options: unknown,
  ) => { readonly data: TestRelationshipRow | null; readonly error: unknown }
>;

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

function createNationRow(
  overrides: Partial<TestNationRow> = {},
): TestNationRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    description: null,
    id: NATION_ID,
    is_hidden: false,
    name: "Highmark",
    nameset_id: null,
    updated_at: "2026-01-02T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createRelationshipRow(
  overrides: Partial<TestRelationshipRow> = {},
): TestRelationshipRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    current_stance: "neutral",
    from_nation_id: NATION_ID,
    id: "99999999-9999-9999-9999-999999999999",
    pending_changed_by_citizen_id: null,
    pending_stance: null,
    pending_status: null,
    to_nation_id: OTHER_NATION_ID,
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function createClient({
  adminRows = [],
  isSuperAdmin = false,
  nationDeleteResult,
  nationRows,
  outgoingRelationships = [],
  relationshipsUpsertResult,
  settlementRows = [],
  worldVisibility = "private",
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly isSuperAdmin?: boolean;
  readonly nationDeleteResult?: NationDeleteResult;
  readonly nationRows: readonly TestNationRow[];
  readonly outgoingRelationships?: readonly TestRelationshipRow[];
  readonly relationshipsUpsertResult?: UpsertMock;
  readonly settlementRows?: readonly TestSettlementRow[];
  readonly worldVisibility?: string;
}): unknown {
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
    is_super_admin: isSuperAdmin,
    status: "active",
    updated_at: "2026-01-01T00:00:00.000Z",
    username: "testuser",
  };

  const listBuilder = {
    eq: vi.fn(() => listBuilder),
    order: vi.fn(() => listBuilder),
    returns: vi.fn().mockResolvedValue({ data: nationRows, error: null }),
  };

  const settlementsBuilder = {
    eq: vi.fn(() => settlementsBuilder),
    order: vi.fn(() => settlementsBuilder),
    returns: vi.fn().mockResolvedValue({ data: settlementRows, error: null }),
  };

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
              maybeSingle: vi.fn().mockResolvedValue({
                data: userRow,
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
            eq: vi.fn(() => ({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: worldRow, error: null }),
            })),
            order: vi.fn().mockResolvedValue({ data: [worldRow], error: null }),
          })),
        };
      }
      if (table === "nations") {
        return {
          delete: vi.fn(() => {
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn(() => chain);
            chain.select = vi.fn(() => chain);
            chain.maybeSingle = vi
              .fn()
              .mockResolvedValue(
                nationDeleteResult ?? { data: null, error: null },
              );
            return chain;
          }),
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
      if (table === "settlements") {
        return { select: vi.fn(() => settlementsBuilder) };
      }
      if (table === "nation_relationships") {
        return {
          select: vi.fn(() => {
            let columnFilter: string | null = null;
            const builder = {
              eq: vi.fn((column: string) => {
                columnFilter = column;
                return builder;
              }),
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
              order: vi.fn(() => builder),
              returns: vi.fn().mockImplementation(() => {
                if (columnFilter === "from_nation_id") {
                  return Promise.resolve({
                    data: outgoingRelationships,
                    error: null,
                  });
                }
                return Promise.resolve({ data: [], error: null });
              }),
            };
            return builder;
          }),
          update: vi.fn(() => {
            const chain = {
              eq: vi.fn(() => chain),
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
              select: vi.fn(() => chain),
            };
            return chain;
          }),
          upsert: vi.fn(
            (values: Record<string, unknown>, options: unknown) => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn().mockImplementation(() => {
                  if (relationshipsUpsertResult !== undefined) {
                    return Promise.resolve(
                      relationshipsUpsertResult(values, options),
                    );
                  }
                  return Promise.resolve({ data: null, error: null });
                }),
              })),
            }),
          ),
        };
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
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
            })),
          })),
        };
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
      throw new Error(`Unexpected table: ${table}`);
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnValue({ subscribe: vi.fn().mockReturnValue({}) }),
    }),
    removeChannel: vi.fn().mockResolvedValue("ok"),
    rpc: vi.fn((fn: string) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: [], error: null });
      }
      if (fn === "settlement_alive_citizen_count") {
        return Promise.resolve({ data: 10, error: null });
      }
      throw new Error(`Unexpected RPC call: ${fn}`);
    }),
  };
}

type TestRouter = {
  readonly state: {
    readonly location: {
      readonly pathname: string;
      readonly search: unknown;
    };
  };
};

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

describe("nation detail route", () => {
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
  });

  describe("section reachability", () => {
    it("renders the overview at the base URL", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          adminRows: [{ world_id: WORLD_ID }],
          nationRows: [createNationRow({ description: "A mountain realm." })],
        }),
      );
      renderAt(BASE_PATH);

      expect(
        await screen.findByRole("heading", { level: 1, name: "Highmark" }),
      ).toBeDefined();
      expect(screen.getByText("A mountain realm.")).toBeDefined();
      expect(screen.getByTestId("active-events-card")).toBeDefined();
    });

    it("renders the settlements list at /settlements", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          adminRows: [{ world_id: WORLD_ID }],
          nationRows: [createNationRow()],
          settlementRows: [
            {
              auto_ready_enabled: false,
              id: SETTLEMENT_ID,
              is_ready_current_turn: false,
              last_ready_at: null,
              name: "Stonehold",
              nation_id: NATION_ID,
              nations: { name: "Highmark" },
              ready_set_at: null,
            },
          ],
        }),
      );
      renderAt(`${BASE_PATH}/settlements`);
      await screen.findByRole("heading", { level: 1, name: "Highmark" });

      const link = await screen.findByRole("link", { name: "Stonehold" });
      expect(link).toHaveAttribute(
        "href",
        `/worlds/${WORLD_ID}/nations/${NATION_ID}/settlements/${SETTLEMENT_ID}`,
      );
    });

    it("renders relationships + admin proposal controls at /relationships", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          adminRows: [{ world_id: WORLD_ID }],
          nationRows: [
            createNationRow(),
            createNationRow({ id: OTHER_NATION_ID, name: "Veilreach" }),
          ],
        }),
      );
      renderAt(`${BASE_PATH}/relationships`);
      await screen.findByRole("heading", { level: 1, name: "Highmark" });

      const veilreachTrigger = await screen.findByRole("button", {
        name: /Veilreach/,
      });
      await userEvent.click(veilreachTrigger);

      expect(
        await screen.findByRole("button", { name: /Propose alliance/ }),
      ).toBeDefined();
    });

    it("hides relationship proposal controls from non-admin viewers at /relationships", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          nationRows: [
            createNationRow(),
            createNationRow({ id: OTHER_NATION_ID, name: "Veilreach" }),
          ],
          worldVisibility: "public",
        }),
      );
      // WorldEntryGate only lets a non-admin past the world gate with a
      // selectable player character — a plain PC (no admin/manager role).
      useActivePlayerCharacterMock.mockReturnValue({
        activeCharacter: PLAIN_CHARACTER,
        clear: vi.fn(),
        isPending: false,
        selectableCharacters: [PLAIN_CHARACTER],
        switchTo: vi.fn(),
      });
      renderAt(`${BASE_PATH}/relationships`);
      await screen.findByRole("heading", { level: 1, name: "Highmark" });

      const veilreachTrigger = await screen.findByRole("button", {
        name: /Veilreach/,
      });
      await userEvent.click(veilreachTrigger);

      expect(
        screen.queryByRole("button", { name: /Propose alliance/ }),
      ).toBeNull();
    });

    it("renders reports + a link to the nation-filtered turn log at /reports", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          adminRows: [{ world_id: WORLD_ID }],
          nationRows: [createNationRow()],
        }),
      );
      renderAt(`${BASE_PATH}/reports`);
      await screen.findByRole("heading", { level: 1, name: "Highmark" });
      const turnLogLink = screen.getByRole("link", {
        name: /view nation turn log/i,
      });
      expect(turnLogLink).toHaveAttribute(
        "href",
        expect.stringContaining(`/worlds/${WORLD_ID}/history`),
      );
    });

    it("renders role assignment at /government for a world admin", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          adminRows: [{ world_id: WORLD_ID }],
          nationRows: [createNationRow()],
        }),
      );
      renderAt(`${BASE_PATH}/government`);
      await screen.findByRole("heading", { level: 1, name: "Highmark" });
      expect(
        await screen.findByText("Settlement Manager assignments"),
      ).toBeDefined();
    });

    it("redirects /government to the overview for a viewer with no admin or manager authority", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          nationRows: [createNationRow()],
          worldVisibility: "public",
        }),
      );
      useActivePlayerCharacterMock.mockReturnValue({
        activeCharacter: PLAIN_CHARACTER,
        clear: vi.fn(),
        isPending: false,
        selectableCharacters: [PLAIN_CHARACTER],
        switchTo: vi.fn(),
      });
      const router = renderAt(`${BASE_PATH}/government`);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(BASE_PATH);
      });
    });

    it("renders role assignment at /government for that nation's alive nation manager", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          nationRows: [createNationRow()],
          worldVisibility: "public",
        }),
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
      renderAt(`${BASE_PATH}/government`);

      expect(
        await screen.findByText("Settlement Manager assignments"),
      ).toBeDefined();
    });

    it("renders the hidden toggle, nameset card, and delete section for admins at /settings", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          adminRows: [{ world_id: WORLD_ID }],
          nationRows: [createNationRow()],
        }),
      );
      renderAt(`${BASE_PATH}/settings`);
      await screen.findByRole("heading", { level: 1, name: "Highmark" });

      expect(screen.getByRole("button", { name: /Hide nation/ })).toBeDefined();
      expect(screen.getByTestId("nameset-card")).toBeDefined();
      expect(
        screen.getByRole("button", { name: "Delete nation" }),
      ).toBeDefined();
    });

    it("redirects /settings to the overview for a true non-admin", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          nationRows: [createNationRow()],
          worldVisibility: "public",
        }),
      );
      useActivePlayerCharacterMock.mockReturnValue({
        activeCharacter: PLAIN_CHARACTER,
        clear: vi.fn(),
        isPending: false,
        selectableCharacters: [PLAIN_CHARACTER],
        switchTo: vi.fn(),
      });
      const router = renderAt(`${BASE_PATH}/settings`);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(BASE_PATH);
      });
    });

    it("shows the admin-suppressed notice at /settings when an admin has an active character", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          adminRows: [{ world_id: WORLD_ID }],
          nationRows: [createNationRow()],
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
      renderAt(`${BASE_PATH}/settings`);
      await screen.findByRole("heading", { level: 1, name: "Highmark" });

      expect(screen.getByText("Admin access paused")).toBeDefined();
      expect(
        screen.queryByRole("button", { name: "Delete nation" }),
      ).toBeNull();
    });
  });

  describe("settings mutations", () => {
    it("emits a success toast and navigates to the nations list after deleting", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          adminRows: [{ world_id: WORLD_ID }],
          nationDeleteResult: {
            data: { id: NATION_ID, world_id: WORLD_ID },
            error: null,
          },
          nationRows: [createNationRow()],
        }),
      );
      const router = renderAt(`${BASE_PATH}/settings`);

      await userEvent.click(
        await screen.findByRole("button", { name: "Delete nation" }),
      );
      const dialog = await screen.findByRole("alertdialog");
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Delete nation" }),
      );

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          `/worlds/${WORLD_ID}/nations`,
        );
      });
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Nation deleted.",
        undefined,
      );
    });
  });

  describe("relationships mutations", () => {
    it("invokes the propose-bilateral mutation when proposing an alliance", async () => {
      const upsertMock: UpsertMock = vi.fn(() => ({
        data: createRelationshipRow({
          pending_stance: "allied",
          pending_status: "proposed",
        }),
        error: null,
      }));
      requireSupabaseClient.mockReturnValue(
        createClient({
          adminRows: [{ world_id: WORLD_ID }],
          nationRows: [
            createNationRow(),
            createNationRow({ id: OTHER_NATION_ID, name: "Veilreach" }),
          ],
          relationshipsUpsertResult: upsertMock,
        }),
      );
      renderAt(`${BASE_PATH}/relationships`);
      await screen.findByRole("heading", { level: 1, name: "Highmark" });

      const veilreachTrigger = await screen.findByRole("button", {
        name: /Veilreach/,
      });
      await userEvent.click(veilreachTrigger);
      await userEvent.click(
        await screen.findByRole("button", { name: /Propose alliance/ }),
      );

      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1);
      });
    });
  });
});
