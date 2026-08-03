import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ActiveCharacterSwitcher,
  ActivePlayerCharacterProvider,
} from "@/features/permissions";

import { WorldEntryGate } from "./WorldEntryGate";

import type { ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    to,
  }: {
    readonly children: ReactNode;
    readonly params?: Readonly<Record<string, string>>;
    readonly to: string;
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
  useParams: vi.fn().mockReturnValue({}),
}));

const USER_ID = "00000000-0000-0000-0000-000000000001";
const WORLD_ID = "00000000-0000-0000-0000-000000000010";
const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000020";
const NATION_ID = "00000000-0000-0000-0000-000000000030";
const PC_ID_A = "00000000-0000-0000-0000-0000000000a1";
const PC_ID_B = "00000000-0000-0000-0000-0000000000b1";

describe("WorldEntryGate", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    // The explicit-admin-choice flag lives in localStorage, keyed by the
    // fixed USER_ID/WORLD_ID constants below — clear it between tests.
    window.localStorage.clear();
  });

  it("renders an inactive-user access denied when the user is not active", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        userStatus: "inactive",
      }),
    );

    renderGate();

    expect(await screen.findByText("Account access unavailable")).toBeDefined();
  });

  it("renders World unavailable when the world cannot be found", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ worldRows: [] }));

    renderGate();

    expect(await screen.findByText("World unavailable")).toBeDefined();
  });

  it("admin direct entry: renders children when admin has no selectable PC", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        worldRows: [createWorldRow()],
        playerCharacters: [],
        activeRow: null,
      }),
    );

    renderGate();

    expect(await screen.findByText("ENTERED")).toBeDefined();
  });

  it("renders access denied when non-admin has no selectable PC", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        // World access via the PC path, but no currently-living selectable
        // character (e.g. it died since world access was last computed).
        pcWorldIds: [WORLD_ID],
        worldRows: [createWorldRow()],
        playerCharacters: [],
        activeRow: null,
      }),
    );

    renderGate();

    expect(await screen.findByText("No character in this world")).toBeDefined();
  });

  it("shows the turn pause overlay while the world's turn runs", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: [WORLD_ID],
        worldRows: [createWorldRow()],
        playerCharacters: [createCitizenRow({ id: PC_ID_A, name: "Solo" })],
        activeRow: {
          citizen_id: PC_ID_A,
          updated_at: "2026-05-01T00:00:00.000Z",
          user_id: USER_ID,
          world_id: WORLD_ID,
        },
        turnTransitionRow: createTurnTransitionRow({
          progress_stage: "simulating",
          status: "running",
        }),
      }),
    );

    renderGate();

    expect(await screen.findByText("Advancing to turn 8")).toBeDefined();
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("does not show the overlay when no transition is running", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: [WORLD_ID],
        worldRows: [createWorldRow()],
        playerCharacters: [createCitizenRow({ id: PC_ID_A, name: "Solo" })],
        activeRow: {
          citizen_id: PC_ID_A,
          updated_at: "2026-05-01T00:00:00.000Z",
          user_id: USER_ID,
          world_id: WORLD_ID,
        },
        turnTransitionRow: createTurnTransitionRow(),
      }),
    );

    renderGate();

    expect(await screen.findByText("ENTERED")).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("auto-selects the only player character and writes the active row", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: [WORLD_ID],
        worldRows: [createWorldRow()],
        playerCharacters: [createCitizenRow({ id: PC_ID_A, name: "Solo" })],
        activeRow: null,
        upsertActiveRow: upsert,
      }),
    );

    renderGate();

    expect(await screen.findByText("ENTERED")).toBeDefined();
    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(
        {
          citizen_id: PC_ID_A,
          user_id: USER_ID,
          world_id: WORLD_ID,
        },
        { onConflict: "user_id,world_id" },
      );
    });
  });

  it("does not re-upsert when the active row already matches the only PC", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: [WORLD_ID],
        worldRows: [createWorldRow()],
        playerCharacters: [createCitizenRow({ id: PC_ID_A, name: "Solo" })],
        activeRow: {
          citizen_id: PC_ID_A,
          updated_at: "2026-05-01T00:00:00.000Z",
          user_id: USER_ID,
          world_id: WORLD_ID,
        },
        upsertActiveRow: upsert,
      }),
    );

    renderGate();

    expect(await screen.findByText("ENTERED")).toBeDefined();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("renders the chooser when multiple PCs and no persisted selection", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: [WORLD_ID],
        worldRows: [createWorldRow()],
        playerCharacters: [
          createCitizenRow({ id: PC_ID_A, name: "Alpha" }),
          createCitizenRow({ id: PC_ID_B, name: "Bravo" }),
        ],
        activeRow: null,
      }),
    );

    renderGate();

    expect(
      await screen.findByText("Choose your player character"),
    ).toBeDefined();
    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Bravo")).toBeDefined();
    expect(screen.queryByText("ENTERED")).toBeNull();
  });

  it("resumes when the persisted active row resolves to a selectable PC", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: [WORLD_ID],
        worldRows: [createWorldRow()],
        playerCharacters: [
          createCitizenRow({ id: PC_ID_A, name: "Alpha" }),
          createCitizenRow({ id: PC_ID_B, name: "Bravo" }),
        ],
        activeRow: {
          citizen_id: PC_ID_B,
          updated_at: "2026-05-01T00:00:00.000Z",
          user_id: USER_ID,
          world_id: WORLD_ID,
        },
      }),
    );

    renderGate();

    expect(await screen.findByText("ENTERED")).toBeDefined();
    expect(screen.queryByText("Choose your player character")).toBeNull();
  });

  it("falls back to the chooser when the persisted active row points at a dead PC", async () => {
    // Include the persisted citizen in the citizens table with status='dead'.
    // The selectable PCs query filters by status='alive', so this row gets
    // excluded and the resume path can no longer match.
    const DEAD_PC_ID = "00000000-0000-0000-0000-0000000000cc";
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: [WORLD_ID],
        worldRows: [createWorldRow()],
        playerCharacters: [
          createCitizenRow({ id: PC_ID_A, name: "Alpha" }),
          createCitizenRow({ id: PC_ID_B, name: "Bravo" }),
          createCitizenRow({
            death_cause: "old age",
            id: DEAD_PC_ID,
            name: "Ghost",
            status: "dead",
          }),
        ],
        activeRow: {
          citizen_id: DEAD_PC_ID,
          updated_at: "2026-05-01T00:00:00.000Z",
          user_id: USER_ID,
          world_id: WORLD_ID,
        },
      }),
    );

    renderGate();

    expect(
      await screen.findByText("Choose your player character"),
    ).toBeDefined();
    expect(screen.queryByText("Ghost")).toBeNull();
  });

  it("tapping a chooser row persists the selection", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: [WORLD_ID],
        worldRows: [createWorldRow()],
        playerCharacters: [
          createCitizenRow({ id: PC_ID_A, name: "Alpha" }),
          createCitizenRow({ id: PC_ID_B, name: "Bravo" }),
        ],
        activeRow: null,
        upsertActiveRow: upsert,
      }),
    );

    renderGate();

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: /Select Bravo/ }),
    );

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(
        {
          citizen_id: PC_ID_B,
          user_id: USER_ID,
          world_id: WORLD_ID,
        },
        { onConflict: "user_id,world_id" },
      );
    });
  });

  it("switching the active character upserts the row and invalidates role-dependent queries", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: [WORLD_ID],
        worldRows: [createWorldRow()],
        playerCharacters: [
          createCitizenRow({ id: PC_ID_A, name: "Alpha" }),
          createCitizenRow({ id: PC_ID_B, name: "Bravo" }),
        ],
        // Persisted active is Bravo so the gate resumes into the world with
        // Bravo active and the switcher (not the chooser) is rendered.
        activeRow: {
          citizen_id: PC_ID_B,
          updated_at: "2026-05-01T00:00:00.000Z",
          user_id: USER_ID,
          world_id: WORLD_ID,
        },
        upsertActiveRow: upsert,
      }),
    );

    const queryClient = renderGate({ withSwitcher: true });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    expect(await screen.findByText("ENTERED")).toBeDefined();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Switch character" }));
    await user.click(await screen.findByRole("menuitem", { name: /Alpha/ }));

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(
        {
          citizen_id: PC_ID_A,
          user_id: USER_ID,
          world_id: WORLD_ID,
        },
        { onConflict: "user_id,world_id" },
      );
    });

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: [
          "permissions",
          "active-player-character-row",
          USER_ID,
          WORLD_ID,
        ],
      });
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["citizens"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["nations"] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settlements"],
    });
  });

  // Regression for issue #978: a single-PC admin picking "Clear" used to
  // race useAutoSelectSinglePlayerCharacter — the row-delete invalidated the
  // active-row query, which refetched to "no row", and the effect
  // immediately re-selected the only PC, permanently suppressing admin
  // access. Entering Admin mode must persist as an explicit choice so
  // auto-select backs off.
  it("entering Admin mode for a single-PC admin sticks instead of racing auto-select", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const del = vi.fn();
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        deleteActiveRow: del,
        playerCharacters: [createCitizenRow({ id: PC_ID_A, name: "Solo" })],
        activeRow: null,
        upsertActiveRow: upsert,
        worldRows: [createWorldRow()],
      }),
    );

    const queryClient = renderGate({ canAdmin: true, withSwitcher: true });

    expect(await screen.findByText("ENTERED")).toBeDefined();
    await waitFor(() => {
      expect(upsert).toHaveBeenCalledTimes(1);
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Switch character" }));
    await user.click(screen.getByRole("menuitem", { name: /Admin/ }));

    await waitFor(() => {
      expect(del).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
      expect(queryClient.isMutating()).toBe(0);
    });

    expect(await screen.findByText("World Admin")).toBeDefined();
    expect(screen.getByText("ENTERED")).toBeDefined();
    // The critical assertion: auto-select must not have fired a second time
    // once the row came back empty.
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("entering Admin mode for a multi-PC admin does not force the chooser back", async () => {
    const del = vi.fn();
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        deleteActiveRow: del,
        playerCharacters: [
          createCitizenRow({ id: PC_ID_A, name: "Alpha" }),
          createCitizenRow({ id: PC_ID_B, name: "Bravo" }),
        ],
        activeRow: {
          citizen_id: PC_ID_A,
          updated_at: "2026-05-01T00:00:00.000Z",
          user_id: USER_ID,
          world_id: WORLD_ID,
        },
        worldRows: [createWorldRow()],
      }),
    );

    const queryClient = renderGate({ canAdmin: true, withSwitcher: true });

    expect(await screen.findByText("ENTERED")).toBeDefined();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Switch character" }));
    await user.click(screen.getByRole("menuitem", { name: /Admin/ }));

    await waitFor(() => {
      expect(del).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
      expect(queryClient.isMutating()).toBe(0);
    });

    expect(await screen.findByText("World Admin")).toBeDefined();
    expect(screen.getByText("ENTERED")).toBeDefined();
    expect(screen.queryByText("Choose your player character")).toBeNull();
  });
});

function renderGate({
  canAdmin = false,
  withSwitcher = false,
}: {
  readonly canAdmin?: boolean;
  readonly withSwitcher?: boolean;
} = {}): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ActivePlayerCharacterProvider userId={USER_ID} worldId={WORLD_ID}>
        {withSwitcher ? (
          <ActiveCharacterSwitcher canAdmin={canAdmin} worldId={WORLD_ID} />
        ) : null}
        <WorldEntryGate worldId={WORLD_ID}>
          <div>ENTERED</div>
        </WorldEntryGate>
      </ActivePlayerCharacterProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

type TestUser = {
  readonly created_at: string;
  readonly email: string;
  readonly id: string;
  readonly is_super_admin: boolean;
  readonly status: string;
  readonly updated_at: string;
  readonly username: string;
};

type TestWorldRow = {
  readonly archived_at: string | null;
  readonly calendar_config_json: null;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly incest_prevention_depth: number;
  readonly name: string;
  readonly status: string;
  readonly updated_at: string;
};

type CitizenRowFixture = {
  readonly born_on_turn_number: number | null;
  readonly citizen_type: "npc" | "player_character";
  readonly created_at: string;
  readonly death_cause: string | null;
  readonly id: string;
  readonly name: string;
  readonly npc_flaw: string | null;
  readonly npc_goal: string | null;
  readonly npc_secret_contradiction: string | null;
  readonly npc_trait_1: string | null;
  readonly npc_trait_2: string | null;
  readonly parent_a_citizen_id: string | null;
  readonly parent_b_citizen_id: string | null;
  readonly personality_text: string | null;
  readonly profile_photo_url: string | null;
  readonly role_nation_id: string | null;
  readonly role_settlement_id: string | null;
  readonly role_type: "none" | "nation_manager" | "settlement_manager";
  readonly settlement_id: string | null;
  readonly sex: string | null;
  readonly skills_text: string | null;
  readonly status: "alive" | "dead";
  readonly updated_at: string;
  readonly user_id: string | null;
  readonly world_id: string;
};

type ActiveRowFixture = {
  readonly citizen_id: string;
  readonly updated_at: string;
  readonly user_id: string;
  readonly world_id: string;
};

function createWorldRow(overrides: Partial<TestWorldRow> = {}): TestWorldRow {
  return {
    archived_at: null,
    calendar_config_json: null,
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 1,
    id: WORLD_ID,
    incest_prevention_depth: 4,
    name: "Test World",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function createCitizenRow(
  overrides: Partial<CitizenRowFixture> = {},
): CitizenRowFixture {
  return {
    born_on_turn_number: null,
    citizen_type: "player_character",
    created_at: "2026-05-01T00:00:00.000Z",
    death_cause: null,
    id: PC_ID_A,
    name: "Player",
    npc_flaw: null,
    npc_goal: null,
    npc_secret_contradiction: null,
    npc_trait_1: null,
    npc_trait_2: null,
    parent_a_citizen_id: null,
    parent_b_citizen_id: null,
    personality_text: null,
    profile_photo_url: null,
    role_nation_id: null,
    role_settlement_id: null,
    role_type: "none",
    settlement_id: SETTLEMENT_ID,
    sex: null,
    skills_text: null,
    status: "alive",
    updated_at: "2026-05-01T00:00:00.000Z",
    user_id: USER_ID,
    world_id: WORLD_ID,
    ...overrides,
  };
}

type ClientOptions = {
  readonly activeRow?: ActiveRowFixture | null;
  readonly adminRows?: ReadonlyArray<{ readonly world_id: string }>;
  readonly deleteActiveRow?: () => void;
  readonly pcWorldIds?: readonly string[];
  readonly playerCharacters?: readonly CitizenRowFixture[];
  readonly turnTransitionRow?: TurnTransitionRowFixture | null;
  readonly upsertActiveRow?: UpsertActiveRowFn;
  readonly userStatus?: "active" | "inactive";
  readonly worldRows?: readonly TestWorldRow[];
};

function createClient({
  activeRow = null,
  adminRows = [],
  deleteActiveRow,
  pcWorldIds = [],
  playerCharacters = [],
  turnTransitionRow = null,
  upsertActiveRow,
  userStatus = "active",
  worldRows = [createWorldRow()],
}: ClientOptions): unknown {
  const user: TestUser = {
    created_at: "2026-01-01T00:00:00.000Z",
    email: "user@example.com",
    id: USER_ID,
    is_super_admin: false,
    status: userStatus,
    updated_at: "2026-01-01T00:00:00.000Z",
    username: "user",
  };

  // A plain closure variable here would be reset every time `.from(...)` is
  // called, since createActiveRowBuilder runs fresh each call — lifting the
  // mutable cell to this scope lets a delete/upsert in one call be reflected
  // by a select in a later call, which the auto-select-vs-clear race tests
  // depend on.
  const activeRowCell: { current: ActiveRowFixture | null } = {
    current: activeRow,
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
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: user, error: null }),
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
        return createWorldsBuilder(worldRows);
      }
      if (table === "turn_transitions") {
        return createTurnTransitionsBuilder(turnTransitionRow);
      }
      if (table === "settlements") {
        return createSettlementsBuilder();
      }
      if (table === "citizens") {
        return createCitizensBuilder(playerCharacters);
      }
      if (table === "user_active_player_characters") {
        return createActiveRowBuilder(
          activeRowCell,
          upsertActiveRow,
          deleteActiveRow,
        );
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn((fn: string) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: pcWorldIds, error: null });
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    }),
  };
}

type TurnTransitionRowFixture = {
  readonly finished_at: string | null;
  readonly from_turn_number: number;
  readonly id: string;
  readonly progress_stage: string | null;
  readonly started_at: string;
  readonly status: string;
  readonly to_turn_number: number;
  readonly world_id: string;
};

function createTurnTransitionRow(
  overrides: Partial<TurnTransitionRowFixture> = {},
): TurnTransitionRowFixture {
  return {
    finished_at: "2026-05-01T00:01:00.000Z",
    from_turn_number: 7,
    id: "00000000-0000-0000-0000-0000000000f1",
    progress_stage: null,
    started_at: "2026-05-01T00:00:00.000Z",
    status: "completed",
    to_turn_number: 8,
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createTurnTransitionsBuilder(
  row: TurnTransitionRowFixture | null,
): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
          })),
        })),
      })),
    })),
  };
}

function createWorldsBuilder(rows: readonly TestWorldRow[]): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn((column: string, value: string) => {
        const data =
          column === "id"
            ? (rows.find((row) => row.id === value) ?? null)
            : null;
        return {
          maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
        };
      }),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    })),
  };
}

function createSettlementsBuilder(): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            coord_x: null,
            coord_z: null,
            created_at: "2026-05-01T00:00:00.000Z",
            description: null,
            id: SETTLEMENT_ID,
            name: "Hometown",
            nation_id: NATION_ID,
            nations: { id: NATION_ID, name: "Homeland", world_id: WORLD_ID },
            updated_at: "2026-05-01T00:00:00.000Z",
          },
          error: null,
        }),
      })),
    })),
  };
}

function createCitizensBuilder(rows: readonly CitizenRowFixture[]): unknown {
  return {
    select: vi.fn(() => {
      const filters: Record<string, unknown> = {};
      const builder: Record<string, unknown> = {
        eq: vi.fn((column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        }),
        order: vi.fn(() => builder),
        returns: vi.fn().mockImplementation(() => {
          const filtered = rows.filter((row) => {
            for (const [column, value] of Object.entries(filters)) {
              if (row[column as keyof CitizenRowFixture] !== value) {
                return false;
              }
            }
            return true;
          });
          return Promise.resolve({ data: filtered, error: null });
        }),
      };
      return builder;
    }),
  };
}

type UpsertActiveRowValues = {
  readonly citizen_id: string;
  readonly user_id: string;
  readonly world_id: string;
};
type UpsertActiveRowFn = (
  values: UpsertActiveRowValues,
  options: unknown,
) => Promise<{ readonly data: null; readonly error: null }>;

// Stateful so delete/upsert calls are reflected in the row a subsequent
// refetch (triggered by query invalidation) reads back — needed to exercise
// the auto-select-vs-clear race in the "does not re-select" regression test.
function createActiveRowBuilder(
  cell: { current: ActiveRowFixture | null },
  upsertFn: UpsertActiveRowFn = () =>
    Promise.resolve({ data: null, error: null }),
  deleteFn?: () => void,
): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve({ data: cell.current, error: null }),
          ),
        })),
      })),
    })),
    upsert: vi.fn((values: UpsertActiveRowValues, options: unknown) => {
      cell.current = {
        citizen_id: values.citizen_id,
        updated_at: "2026-05-01T00:00:00.000Z",
        user_id: values.user_id,
        world_id: values.world_id,
      };
      return upsertFn(values, options);
    }),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => {
          cell.current = null;
          deleteFn?.();
          return Promise.resolve({ data: null, error: null });
        }),
      })),
    })),
  };
}
