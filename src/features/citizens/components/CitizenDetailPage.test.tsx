import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivePlayerCharacterContextValue } from "@/features/permissions";

import { CitizenDetailPage } from "./CitizenDetailPage";

import type { Citizen } from "../types/citizenTypes";
import type { ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
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

vi.mock("./PartnershipHistoryPanel", () => ({
  PartnershipHistoryPanel: () => (
    <div data-testid="partnership-history-panel" />
  ),
}));

vi.mock("./NpcFlavorLine", () => ({
  NpcFlavorLine: () => <div data-testid="npc-flavor-line" />,
}));

vi.mock("./NpcFlavorEditor", () => ({
  NpcFlavorEditor: () => <div data-testid="npc-flavor-editor" />,
}));

vi.mock("@/features/permissions", async () => {
  const actual = await vi.importActual("@/features/permissions");
  return {
    ...actual,
    RoleAssignmentControls: ({
      canAdminWorld,
    }: {
      readonly canAdminWorld: boolean;
    }) =>
      canAdminWorld ? <div data-testid="role-assignment-controls" /> : null,
    useActivePlayerCharacter: useActivePlayerCharacterMock,
  };
});

const USER_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000aa";
const WORLD_ID = "00000000-0000-0000-0000-000000000010";
const CITIZEN_ID = "00000000-0000-0000-0000-000000000020";
const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000030";
const NATION_ID = "00000000-0000-0000-0000-000000000040";

describe("CitizenDetailPage", () => {
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

  it("renders admin-only edit and lifecycle controls for world admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        citizen: createCitizenRow({
          citizen_type: "player_character",
          name: "Aldra",
          user_id: OTHER_USER_ID,
        }),
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Aldra" }),
    ).toBeDefined();
    expect(screen.getByText("Player character.")).toBeDefined();
    expect(
      screen.getAllByRole("button", { name: /Edit/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Mark dead" })).toBeDefined();
    expect(screen.getByTestId("role-assignment-controls")).toBeDefined();
    expect(screen.getByTestId("partnership-history-panel")).toBeDefined();
  });

  it("renders the deceased status and revive control for dead citizens viewed by admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: WORLD_ID }],
        citizen: createCitizenRow({
          death_cause: "fever",
          name: "Cael",
          status: "dead",
        }),
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Cael" }),
    ).toBeDefined();
    expect(screen.getAllByText("Deceased").length).toBeGreaterThan(0);
    expect(screen.getByText("Cause of death: fever")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Revive citizen" }),
    ).toBeDefined();
  });

  it("renders the page for the linked PC viewing themselves without admin or lifecycle controls", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [],
        citizen: createCitizenRow({
          citizen_type: "player_character",
          name: "Brann",
          user_id: USER_ID,
        }),
        worldOwnerId: OTHER_USER_ID,
        worldVisibility: "public",
      }),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Brann" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark dead" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Revive citizen" })).toBeNull();
    expect(screen.queryByTestId("role-assignment-controls")).toBeNull();
    expect(screen.getByTestId("partnership-history-panel")).toBeDefined();
  });

  it("redirects nation and settlement managers to their settlement detail screen", async () => {
    useActivePlayerCharacterMock.mockReturnValue({
      activeCharacter: { roleType: "nation_manager" } as Citizen,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [],
        citizen: createCitizenRow({
          citizen_type: "npc",
          name: "Cael",
          user_id: null,
        }),
        worldOwnerId: OTHER_USER_ID,
        worldVisibility: "public",
      }),
    );

    renderPage();

    expect(
      await screen.findByText(/Nation and settlement managers/i),
    ).toBeDefined();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        params: {
          nationId: NATION_ID,
          settlementId: SETTLEMENT_ID,
          worldId: WORLD_ID,
        },
        replace: true,
        to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
      });
    });
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("redirects plain player characters with a tailored message", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [],
        citizen: createCitizenRow({
          citizen_type: "player_character",
          name: "Renn",
          user_id: OTHER_USER_ID,
        }),
        worldOwnerId: OTHER_USER_ID,
        worldVisibility: "public",
      }),
    );

    renderPage();

    expect(
      await screen.findByText(
        /Citizen detail is only available for your own living character/i,
      ),
    ).toBeDefined();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        params: {
          nationId: NATION_ID,
          settlementId: SETTLEMENT_ID,
          worldId: WORLD_ID,
        },
        replace: true,
        to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
      });
    });
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("renders an access-denied state for citizens without a settlement", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [],
        citizen: createCitizenRow({
          citizen_type: "npc",
          name: "Drifter",
          settlement_id: null,
          user_id: null,
        }),
        worldOwnerId: OTHER_USER_ID,
        worldVisibility: "public",
      }),
    );

    renderPage();

    expect(
      await screen.findByText(/Only world administrators can view/i),
    ).toBeDefined();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  describe("CitizenLinkedUserControl", () => {
    it("shows a user picker with username · email options when the admin opens the link editor", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          adminRows: [{ world_id: WORLD_ID }],
          citizen: createCitizenRow({
            citizen_type: "player_character",
            name: "Aldra",
            user_id: null,
          }),
          usersRows: [USER_ROW, OTHER_USER_ROW],
        }),
      );

      renderPage();

      const linkButton = await screen.findByRole("button", {
        name: "Link user",
      });
      await userEvent.click(linkButton);

      const select = screen.getByRole("combobox");
      expect(select).toBeDefined();

      const options = Array.from((select as HTMLSelectElement).options).map(
        (o) => o.text,
      );
      expect(options).toContain("user · user@example.com");
      expect(options).toContain("otheruser · other@example.com");
    });

    it("shows an error message when the users query fails", async () => {
      requireSupabaseClient.mockReturnValue(
        createClient({
          adminRows: [{ world_id: WORLD_ID }],
          citizen: createCitizenRow({
            citizen_type: "player_character",
            name: "Aldra",
            user_id: null,
          }),
          usersQueryFails: true,
        }),
      );

      renderPage();

      const linkButton = await screen.findByRole("button", {
        name: "Link user",
      });
      await userEvent.click(linkButton);

      expect(await screen.findByText(/Failed to load users/i)).toBeDefined();
    });

    it("links the selected user when the form is submitted", async () => {
      const linkedCitizenRow = createCitizenRow({
        citizen_type: "player_character",
        name: "Aldra",
        user_id: OTHER_USER_ID,
      });
      const rpcMock = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: linkedCitizenRow,
          error: null,
        }),
      });
      const client = createClient({
        adminRows: [{ world_id: WORLD_ID }],
        citizen: createCitizenRow({
          citizen_type: "player_character",
          name: "Aldra",
          user_id: null,
        }),
        usersRows: [USER_ROW, OTHER_USER_ROW],
      });
      (client as Record<string, unknown>).rpc = rpcMock;
      requireSupabaseClient.mockReturnValue(client);

      renderPage();

      const linkButton = await screen.findByRole("button", {
        name: "Link user",
      });
      await userEvent.click(linkButton);

      const select = await screen.findByRole("combobox");
      await userEvent.selectOptions(select, OTHER_USER_ID);

      await userEvent.click(screen.getByRole("button", { name: "Link user" }));

      await waitFor(() => {
        expect(rpcMock).toHaveBeenCalledWith("link_user_to_citizen", {
          p_citizen_id: CITIZEN_ID,
          p_user_id: OTHER_USER_ID,
        });
      });
    });
  });
});

function renderPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <CitizenDetailPage citizenId={CITIZEN_ID} worldId={WORLD_ID} />
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

function createCitizenRow(
  overrides: Partial<CitizenRowFixture> = {},
): CitizenRowFixture {
  return {
    born_on_turn_number: 1,
    citizen_type: "npc",
    created_at: "2026-05-01T00:00:00.000Z",
    death_cause: null,
    id: CITIZEN_ID,
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

const USER_ROW = {
  created_at: "2026-01-01T00:00:00.000Z",
  email: "user@example.com",
  id: USER_ID,
  is_super_admin: false,
  status: "active",
  updated_at: "2026-01-01T00:00:00.000Z",
  username: "user",
};

const OTHER_USER_ROW = {
  created_at: "2026-01-01T00:00:00.000Z",
  email: "other@example.com",
  id: OTHER_USER_ID,
  is_super_admin: false,
  status: "active",
  updated_at: "2026-01-01T00:00:00.000Z",
  username: "otheruser",
};

function createClient({
  adminRows,
  citizen,
  usersRows = [USER_ROW],
  usersQueryFails = false,
  worldOwnerId = USER_ID,
  worldVisibility = "private",
}: {
  readonly adminRows: ReadonlyArray<{ readonly world_id: string }>;
  readonly citizen: CitizenRowFixture;
  readonly usersRows?: readonly (typeof USER_ROW)[];
  readonly usersQueryFails?: boolean;
  readonly worldOwnerId?: string;
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
    owner_id: worldOwnerId,
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: worldVisibility,
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
        return createUsersBuilder(USER_ROW, usersRows, usersQueryFails);
      }
      if (table === "world_admins") {
        return createWorldAdminsBuilder(adminRows);
      }
      if (table === "worlds") {
        return createWorldsBuilder(worldRow);
      }
      if (table === "citizens") {
        return {
          select: vi.fn((columns: string) => {
            if (columns === "world_id") {
              const b: Record<string, unknown> = {};
              b.eq = vi.fn(() => b);
              b.order = vi.fn().mockResolvedValue({ data: [], error: null });
              return b;
            }
            const detailBuilder: Record<string, unknown> = {};
            detailBuilder.eq = vi.fn(() => detailBuilder);
            detailBuilder.order = vi.fn(() => detailBuilder);
            detailBuilder.maybeSingle = vi
              .fn()
              .mockResolvedValue({ data: citizen, error: null });
            return detailBuilder;
          }),
        };
      }
      if (table === "citizen_assignments") {
        return createSingleSelectBuilder(null);
      }
      if (table === "settlements") {
        return createSettlementsBuilder();
      }
      throw new Error(`Unexpected table ${table}`);
    }),
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

function createSingleSelectBuilder(data: unknown): unknown {
  return {
    select: vi.fn(() => {
      const builder: Record<string, unknown> = {
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
      };
      return builder;
    }),
  };
}

function createUsersBuilder(
  singleUser: unknown,
  listRows: readonly unknown[],
  listQueryFails = false,
): unknown {
  const listResult = listQueryFails
    ? { data: null, error: { code: "PGRST301", message: "Forbidden" } }
    : { data: listRows, error: null };
  return {
    select: vi.fn(() => {
      const builder: Record<string, unknown> = {
        eq: vi.fn(() => builder),
        order: vi.fn().mockResolvedValue(listResult),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: singleUser, error: null }),
      };
      return builder;
    }),
  };
}

function createWorldAdminsBuilder(
  rows: ReadonlyArray<{ readonly world_id: string }>,
): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: rows, error: null }),
      })),
    })),
  };
}

function createWorldsBuilder(worldRow: unknown): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: worldRow, error: null }),
      })),
      order: vi.fn().mockResolvedValue({ data: [worldRow], error: null }),
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
