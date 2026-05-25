import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorldEntryGate } from "./WorldEntryGate";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
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
        worldRows: [createWorldRow({ owner_id: USER_ID })],
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
        worldRows: [
          // Public world so the user can access but isn't an admin.
          createWorldRow({ owner_id: "another-user", visibility: "public" }),
        ],
        playerCharacters: [],
        activeRow: null,
      }),
    );

    renderGate();

    expect(await screen.findByText("No character in this world")).toBeDefined();
  });

  it("auto-selects the only player character and writes the active row", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    requireSupabaseClient.mockReturnValue(
      createClient({
        worldRows: [
          createWorldRow({ owner_id: "another-user", visibility: "public" }),
        ],
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
        worldRows: [
          createWorldRow({ owner_id: "another-user", visibility: "public" }),
        ],
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
        worldRows: [
          createWorldRow({ owner_id: "another-user", visibility: "public" }),
        ],
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
        worldRows: [
          createWorldRow({ owner_id: "another-user", visibility: "public" }),
        ],
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
    // The selectable PCs query already filters to status='alive', so a dead
    // persisted citizen simply won't appear in the selectable list and the
    // resume path won't match.
    requireSupabaseClient.mockReturnValue(
      createClient({
        worldRows: [
          createWorldRow({ owner_id: "another-user", visibility: "public" }),
        ],
        playerCharacters: [
          createCitizenRow({ id: PC_ID_A, name: "Alpha" }),
          createCitizenRow({ id: PC_ID_B, name: "Bravo" }),
        ],
        // The active row points at a citizen that is not in the selectable
        // list — same effect as that citizen being dead per the RLS-backed
        // selectable query (status='alive' filter).
        activeRow: {
          citizen_id: "00000000-0000-0000-0000-0000000000cc",
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
  });

  it("tapping a chooser row persists the selection", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    requireSupabaseClient.mockReturnValue(
      createClient({
        worldRows: [
          createWorldRow({ owner_id: "another-user", visibility: "public" }),
        ],
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
});

function renderGate(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <WorldEntryGate worldId={WORLD_ID}>
        <div>ENTERED</div>
      </WorldEntryGate>
    </QueryClientProvider>,
  );
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
  readonly owner_id: string;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
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
    owner_id: USER_ID,
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "public",
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
  readonly playerCharacters?: readonly CitizenRowFixture[];
  readonly upsertActiveRow?: ReturnType<typeof vi.fn>;
  readonly userStatus?: "active" | "inactive";
  readonly worldRows?: readonly TestWorldRow[];
};

function createClient({
  activeRow = null,
  adminRows = [],
  playerCharacters = [],
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
      if (table === "settlements") {
        return createSettlementsBuilder();
      }
      if (table === "citizens") {
        return createCitizensBuilder(playerCharacters);
      }
      if (table === "user_active_player_characters") {
        return createActiveRowBuilder(activeRow, upsertActiveRow);
      }
      throw new Error(`Unexpected table ${table}`);
    }),
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

function createActiveRowBuilder(
  row: ActiveRowFixture | null,
  upsertFn: ReturnType<typeof vi.fn> | undefined,
): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
        })),
      })),
    })),
    upsert: upsertFn ?? vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}
