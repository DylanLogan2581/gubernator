import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import type { Citizen } from "@/features/citizens";
import type { Nation } from "@/features/nations";

import { RoleAssignmentControls } from "./RoleAssignmentControls";

import type { ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

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

const NATION_ID = "00000000-0000-4000-8000-000000000010";
const SETTLEMENT_ID = "00000000-0000-4000-8000-000000000020";
const WORLD_ID = "00000000-0000-4000-8000-000000000001";
const CITIZEN_PC_ID = "00000000-0000-4000-8000-000000000100";
const CITIZEN_NPC_ID = "00000000-0000-4000-8000-000000000101";
const CITIZEN_ELIGIBLE_ID = "00000000-0000-4000-8000-000000000200";
const CITIZEN_EXISTING_SM_ID = "00000000-0000-4000-8000-000000000201";
const CITIZEN_NM_ID = "00000000-0000-4000-8000-000000000202";

describe("RoleAssignmentControls — citizen variant", () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
    requireSupabaseClient.mockReset();
  });

  it("renders nothing when the viewer is not a world admin", () => {
    requireSupabaseClient.mockReturnValue(createSupabaseClient({}));
    const { container } = renderControls(
      <RoleAssignmentControls
        canAdminWorld={false}
        citizen={toCitizen(
          createCitizenRow({
            citizen_type: "player_character",
            id: CITIZEN_PC_ID,
            role_type: "none",
            settlement_id: SETTLEMENT_ID,
          }),
        )}
        isArchived={false}
        variant="citizen"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the citizen is not a player character", () => {
    requireSupabaseClient.mockReturnValue(createSupabaseClient({}));
    const { container } = renderControls(
      <RoleAssignmentControls
        canAdminWorld={true}
        citizen={toCitizen(
          createCitizenRow({
            citizen_type: "npc",
            id: CITIZEN_NPC_ID,
            role_type: "none",
            settlement_id: SETTLEMENT_ID,
          }),
        )}
        isArchived={false}
        variant="citizen"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("submits assign_citizen_role with the citizen's settlement when admin picks Settlement manager", async () => {
    const updatedRow = createCitizenRow({
      citizen_type: "player_character",
      id: CITIZEN_PC_ID,
      role_settlement_id: SETTLEMENT_ID,
      role_type: "settlement_manager",
      settlement_id: SETTLEMENT_ID,
    });
    const rpcAssign = vi.fn().mockReturnValue({
      maybeSingle: () => Promise.resolve({ data: updatedRow, error: null }),
    });
    requireSupabaseClient.mockReturnValue(
      createSupabaseClient({
        rpc: vi.fn((name: string, _args: unknown): unknown => {
          if (name === "assign_citizen_role") {
            return rpcAssign(_args);
          }
          throw new Error(`Unexpected rpc ${name}`);
        }),
        settlementById: {
          coord_x: null,
          coord_z: null,
          created_at: "2026-05-01T00:00:00.000Z",
          description: null,
          id: SETTLEMENT_ID,
          name: "Riverside",
          nation_id: NATION_ID,
          nations: { id: NATION_ID, name: "Aurelia", world_id: WORLD_ID },
          updated_at: "2026-05-01T00:00:00.000Z",
        },
      }),
    );

    renderControls(
      <RoleAssignmentControls
        canAdminWorld={true}
        citizen={toCitizen(
          createCitizenRow({
            citizen_type: "player_character",
            id: CITIZEN_PC_ID,
            role_type: "none",
            settlement_id: SETTLEMENT_ID,
          }),
        )}
        isArchived={false}
        variant="citizen"
      />,
    );

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Change role" }),
    );

    const select = await screen.findByLabelText("Role type");
    await user.selectOptions(select, "settlement_manager");

    // Scope select should appear and show the citizen's settlement name.
    await waitFor(() => {
      expect(screen.getByLabelText("Settlement")).toBeDefined();
    });
    expect(screen.getByRole("option", { name: "Riverside" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Save role" }));

    await waitFor(() => {
      expect(rpcAssign).toHaveBeenCalledWith({
        p_citizen_id: CITIZEN_PC_ID,
        p_role_nation_id: undefined,
        p_role_settlement_id: SETTLEMENT_ID,
        p_role_type: "settlement_manager",
      });
    });
  });

  it("submits revoke_citizen_role when admin selects None", async () => {
    const updatedRow = createCitizenRow({
      citizen_type: "player_character",
      id: CITIZEN_PC_ID,
      role_settlement_id: null,
      role_type: "none",
      settlement_id: SETTLEMENT_ID,
    });
    const rpcRevoke = vi.fn().mockReturnValue({
      maybeSingle: () => Promise.resolve({ data: updatedRow, error: null }),
    });
    requireSupabaseClient.mockReturnValue(
      createSupabaseClient({
        rpc: vi.fn((name: string, _args: unknown): unknown => {
          if (name === "revoke_citizen_role") {
            return rpcRevoke(_args);
          }
          throw new Error(`Unexpected rpc ${name}`);
        }),
        settlementById: {
          coord_x: null,
          coord_z: null,
          created_at: "2026-05-01T00:00:00.000Z",
          description: null,
          id: SETTLEMENT_ID,
          name: "Riverside",
          nation_id: NATION_ID,
          nations: { id: NATION_ID, name: "Aurelia", world_id: WORLD_ID },
          updated_at: "2026-05-01T00:00:00.000Z",
        },
      }),
    );

    renderControls(
      <RoleAssignmentControls
        canAdminWorld={true}
        citizen={toCitizen(
          createCitizenRow({
            citizen_type: "player_character",
            id: CITIZEN_PC_ID,
            role_settlement_id: SETTLEMENT_ID,
            role_type: "settlement_manager",
            settlement_id: SETTLEMENT_ID,
          }),
        )}
        isArchived={false}
        variant="citizen"
      />,
    );

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Change role" }),
    );
    await user.selectOptions(await screen.findByLabelText("Role type"), "none");
    await user.click(screen.getByRole("button", { name: "Save role" }));

    await waitFor(() => {
      expect(rpcRevoke).toHaveBeenCalledWith({ p_citizen_id: CITIZEN_PC_ID });
    });
  });
});

describe("RoleAssignmentControls — nation variant", () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
    requireSupabaseClient.mockReset();
  });

  it("renders nothing when the viewer is neither admin nor nation manager", () => {
    requireSupabaseClient.mockReturnValue(createSupabaseClient({}));
    const { container } = renderControls(
      <RoleAssignmentControls
        canAdminWorld={false}
        isArchived={false}
        isNationManager={false}
        nation={createNation()}
        variant="nation"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("lists player characters in the nation whose role is none or settlement_manager", async () => {
    requireSupabaseClient.mockReturnValue(
      createSupabaseClient({
        nationSettlements: [{ id: SETTLEMENT_ID }],
        playerCharacters: [
          createCitizenRow({
            citizen_type: "player_character",
            id: CITIZEN_ELIGIBLE_ID,
            name: "Eligible",
            role_type: "none",
            settlement_id: SETTLEMENT_ID,
          }),
          createCitizenRow({
            citizen_type: "player_character",
            id: CITIZEN_EXISTING_SM_ID,
            name: "Existing SM",
            role_settlement_id: SETTLEMENT_ID,
            role_type: "settlement_manager",
            settlement_id: SETTLEMENT_ID,
          }),
          createCitizenRow({
            citizen_type: "player_character",
            id: CITIZEN_NM_ID,
            name: "Nation Mgr",
            role_nation_id: NATION_ID,
            role_type: "nation_manager",
            settlement_id: SETTLEMENT_ID,
          }),
        ],
      }),
    );

    renderControls(
      <RoleAssignmentControls
        canAdminWorld={false}
        isArchived={false}
        isNationManager={true}
        nation={createNation()}
        variant="nation"
      />,
    );

    expect(await screen.findByText("Eligible")).toBeDefined();
    expect(screen.getByText("Existing SM")).toBeDefined();
    // Nation manager is excluded from the list (only none / settlement_manager).
    expect(screen.queryByText("Nation Mgr")).toBeNull();
  });

  it("nation manager can assign Settlement Manager via assign_citizen_role", async () => {
    const updatedRow = createCitizenRow({
      citizen_type: "player_character",
      id: CITIZEN_ELIGIBLE_ID,
      role_settlement_id: SETTLEMENT_ID,
      role_type: "settlement_manager",
      settlement_id: SETTLEMENT_ID,
    });
    const rpcAssign = vi.fn().mockReturnValue({
      maybeSingle: () => Promise.resolve({ data: updatedRow, error: null }),
    });
    requireSupabaseClient.mockReturnValue(
      createSupabaseClient({
        nationSettlements: [{ id: SETTLEMENT_ID }],
        playerCharacters: [
          createCitizenRow({
            citizen_type: "player_character",
            id: CITIZEN_ELIGIBLE_ID,
            name: "Eligible",
            role_type: "none",
            settlement_id: SETTLEMENT_ID,
          }),
        ],
        rpc: vi.fn((name: string, _args: unknown): unknown => {
          if (name === "assign_citizen_role") {
            return rpcAssign(_args);
          }
          throw new Error(`Unexpected rpc ${name}`);
        }),
      }),
    );

    renderControls(
      <RoleAssignmentControls
        canAdminWorld={false}
        isArchived={false}
        isNationManager={true}
        nation={createNation()}
        variant="nation"
      />,
    );

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Assign Settlement Manager" }),
    );

    await waitFor(() => {
      expect(rpcAssign).toHaveBeenCalledWith({
        p_citizen_id: CITIZEN_ELIGIBLE_ID,
        p_role_nation_id: undefined,
        p_role_settlement_id: SETTLEMENT_ID,
        p_role_type: "settlement_manager",
      });
    });
  });
});

function renderControls(node: ReactNode): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
}

function createNation(): Nation {
  return {
    createdAt: "2026-05-01T00:00:00.000Z",
    description: null,
    id: NATION_ID,
    isHidden: false,
    name: "Aurelia",
    updatedAt: "2026-05-01T00:00:00.000Z",
    worldId: WORLD_ID,
  };
}

function createCitizenRow(
  overrides: Partial<CitizenRowFixture> = {},
): CitizenRowFixture {
  return {
    born_on_turn_number: null,
    citizen_type: "npc",
    created_at: "2026-05-01T00:00:00.000Z",
    death_cause: null,
    id: "c-1",
    name: "Citizen",
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
    user_id: null,
    world_id: WORLD_ID,
    ...overrides,
  };
}

function toCitizen(row: CitizenRowFixture): Citizen {
  return {
    bornOnTurnNumber: row.born_on_turn_number,
    citizenType: row.citizen_type,
    createdAt: row.created_at,
    deathCause: row.death_cause,
    id: row.id,
    name: row.name,
    npcFlaw: row.npc_flaw,
    npcGoal: row.npc_goal,
    npcSecretContradiction: row.npc_secret_contradiction,
    npcTrait1: row.npc_trait_1,
    npcTrait2: row.npc_trait_2,
    parentACitizenId: row.parent_a_citizen_id,
    parentBCitizenId: row.parent_b_citizen_id,
    personalityText: row.personality_text,
    profilePhotoUrl: row.profile_photo_url,
    roleNationId: row.role_nation_id,
    roleSettlementId: row.role_settlement_id,
    roleType: row.role_type,
    settlementId: row.settlement_id,
    sex: row.sex,
    skillsText: row.skills_text,
    status: row.status,
    updatedAt: row.updated_at,
    userId: row.user_id,
    worldId: row.world_id,
  };
}

type SettlementRow = {
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

type SupabaseFixtures = {
  readonly nationSettlements?: ReadonlyArray<{ readonly id: string }>;
  readonly playerCharacters?: readonly CitizenRowFixture[];
  readonly rpc?: ReturnType<typeof vi.fn>;
  readonly settlementById?: SettlementRow | null;
};

function createSupabaseClient(fixtures: SupabaseFixtures): unknown {
  const {
    nationSettlements = [],
    playerCharacters = [],
    rpc,
    settlementById = null,
  } = fixtures;

  function citizensBuilder(): unknown {
    const filters: Record<string, unknown> = {};
    let inFilter: { column: string; values: readonly string[] } | null = null;

    const builder: Record<string, unknown> = {
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      }),
      in: vi.fn((column: string, values: readonly string[]) => {
        inFilter = { column, values };
        return builder;
      }),
      order: vi.fn(() => builder),
      returns: vi.fn(() => {
        const filtered = playerCharacters.filter((row) => {
          for (const [column, value] of Object.entries(filters)) {
            if (row[column as keyof CitizenRowFixture] !== value) {
              return false;
            }
          }
          if (
            inFilter !== null &&
            !inFilter.values.includes(
              row[inFilter.column as keyof CitizenRowFixture] as string,
            )
          ) {
            return false;
          }
          return true;
        });
        return Promise.resolve({ data: filtered, error: null });
      }),
    };
    return builder;
  }

  function settlementsBuilder(): unknown {
    const filters: Record<string, unknown> = {};
    const builder: Record<string, unknown> = {
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      }),
      returns: vi.fn(() => {
        const filtered =
          filters["nation_id"] === undefined ||
          filters["nation_id"] === NATION_ID
            ? nationSettlements
            : [];
        return Promise.resolve({ data: filtered, error: null });
      }),
      maybeSingle: vi.fn(() => {
        if (
          filters["id"] !== undefined &&
          settlementById !== null &&
          settlementById.id === filters["id"]
        ) {
          return Promise.resolve({ data: settlementById, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };
    return builder;
  }

  return {
    from: vi.fn((table: string) => {
      if (table === "citizens") {
        return {
          select: vi.fn(() => citizensBuilder()),
        };
      }
      if (table === "settlements") {
        return {
          select: vi.fn(() => settlementsBuilder()),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: rpc ?? vi.fn(),
  };
}
