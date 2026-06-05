import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PartnershipHistoryPanel } from "./PartnershipHistoryPanel";

import type { Citizen } from "../types/citizenTypes";
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
    to,
    params,
    className,
  }: {
    readonly children: ReactNode;
    readonly to: string;
    readonly params?: Readonly<Record<string, string>>;
    readonly className?: string;
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
}));

const FOCAL_CITIZEN_ID = "11111111-1111-1111-1111-111111111111";
const PARTNER_CITIZEN_ID = "22222222-2222-2222-2222-222222222222";
const THIRD_CITIZEN_ID = "55555555-5555-5555-5555-555555555555";
const PARTNERSHIP_ID = "33333333-3333-3333-3333-333333333333";
const TURN_TRANSITION_ID = "44444444-4444-4444-4444-444444444444";

type PartnershipRowFixture = {
  readonly change_reason: string | null;
  readonly changed_by_user_id: string | null;
  readonly citizen_a_id: string;
  readonly citizen_b_id: string;
  readonly created_at: string;
  readonly ended_on_turn_number: number | null;
  readonly formed_on_turn_number: number;
  readonly id: string;
  readonly status: "active" | "dissolved" | "widowed";
  readonly updated_at: string;
};

type CitizenRowFixture = {
  readonly born_on_turn_number: number | null;
  readonly citizen_type: "npc" | "player_character";
  readonly created_at: string;
  readonly death_cause: string | null;
  readonly death_cause_category:
    | "starvation"
    | "homeless"
    | "event"
    | "manual_admin"
    | "unknown"
    | null;
  readonly given_name: string;
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
  readonly surname: string | null;
  readonly updated_at: string;
  readonly user_id: string | null;
  readonly world_id: string;
};

describe("PartnershipHistoryPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("shows an empty state when the citizen has no partnerships", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ partnerships: [], citizens: [createCitizenRow()] }),
    );

    renderPanel({ canAdmin: false });

    expect(await screen.findByText("No partnerships")).toBeDefined();
    expect(
      screen.queryByRole("button", { name: "Create partnership" }),
    ).toBeNull();
  });

  it("renders the partner's name as a link and labels cross-settlement partnerships", async () => {
    const focal = createCitizenRow({
      id: "c-focal",
      name: "Alta",
      settlement_id: "settlement-1",
    });
    const partner = createCitizenRow({
      id: "c-partner",
      name: "Brann",
      settlement_id: "settlement-2",
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        partnerships: [
          createPartnershipRow({
            citizen_a_id: "c-focal",
            citizen_b_id: "c-partner",
            formed_on_turn_number: 12,
            id: "p-1",
            status: "active",
          }),
        ],
        citizens: [focal, partner],
      }),
    );

    renderPanel({ canAdmin: false, focal });

    const partnerLink = await screen.findByRole("link", { name: "Brann" });
    expect(partnerLink.getAttribute("href")).toBe(
      "/worlds/world-1/citizens/c-partner",
    );
    await waitFor(() => {
      expect(screen.queryByText("Cross-settlement")).not.toBeNull();
    });
    expect(screen.getByText(/Formed on turn 12/)).toBeDefined();
    expect(screen.getByText("Active")).toBeDefined();
  });

  it("hides admin controls for non-admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        partnerships: [
          createPartnershipRow({
            change_reason: "Married in spring.",
            citizen_a_id: "c-focal",
            citizen_b_id: "c-partner",
            id: "p-1",
            status: "active",
          }),
        ],
        citizens: [
          createCitizenRow({ id: "c-focal" }),
          createCitizenRow({ id: "c-partner", name: "Brann" }),
        ],
      }),
    );

    renderPanel({ canAdmin: false });

    await screen.findByText("Brann");
    expect(screen.queryByRole("button", { name: "Dissolve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark widowed" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reassign" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Create partnership" }),
    ).toBeNull();
  });

  it("offers Create partnership for admins when no active partnership exists", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        partnerships: [
          createPartnershipRow({
            citizen_a_id: "c-focal",
            citizen_b_id: "c-partner",
            ended_on_turn_number: 7,
            id: "p-1",
            status: "dissolved",
          }),
        ],
        citizens: [
          createCitizenRow({ id: "c-focal" }),
          createCitizenRow({ id: "c-partner", name: "Brann" }),
        ],
        currentTurnNumber: 9,
        latestTransitionId: "tt-1",
      }),
    );

    renderPanel({ canAdmin: true });

    const createButton = await screen.findByRole("button", {
      name: "Create partnership",
    });
    await waitFor(() => {
      expect(createButton).not.toBeDisabled();
    });
  });

  it("disables Create partnership when the world has no recorded turn transition", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        partnerships: [],
        citizens: [createCitizenRow({ id: "c-focal" })],
        currentTurnNumber: 1,
        latestTransitionId: null,
      }),
    );

    renderPanel({ canAdmin: true });

    expect(
      await screen.findByText(/at least one recorded turn transition/i),
    ).toBeDefined();
    const createButton = screen.getByRole("button", {
      name: "Create partnership",
    });
    expect(createButton).toBeDisabled();
  });

  it("exposes Dissolve, Mark widowed, and Reassign for active partnerships", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        partnerships: [
          createPartnershipRow({
            citizen_a_id: "c-focal",
            citizen_b_id: "c-partner",
            id: "p-1",
            status: "active",
          }),
        ],
        citizens: [
          createCitizenRow({ id: "c-focal" }),
          createCitizenRow({ id: "c-partner", name: "Brann" }),
        ],
        currentTurnNumber: 9,
        latestTransitionId: "tt-1",
      }),
    );

    renderPanel({ canAdmin: true });

    const dissolve = await screen.findByRole("button", { name: "Dissolve" });
    await waitFor(() => {
      expect(dissolve).not.toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Mark widowed" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Reassign" })).toBeDefined();
  });

  it("dispatches dissolve_partnership when the dissolve form is submitted", async () => {
    const rpc = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: createPartnershipRow({
          citizen_a_id: FOCAL_CITIZEN_ID,
          citizen_b_id: PARTNER_CITIZEN_ID,
          ended_on_turn_number: 9,
          id: PARTNERSHIP_ID,
          status: "dissolved",
        }),
        error: null,
      }),
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        partnerships: [
          createPartnershipRow({
            citizen_a_id: FOCAL_CITIZEN_ID,
            citizen_b_id: PARTNER_CITIZEN_ID,
            id: PARTNERSHIP_ID,
            status: "active",
          }),
        ],
        citizens: [
          createCitizenRow({ id: FOCAL_CITIZEN_ID }),
          createCitizenRow({ id: PARTNER_CITIZEN_ID, name: "Brann" }),
        ],
        currentTurnNumber: 9,
        latestTransitionId: TURN_TRANSITION_ID,
        rpc,
      }),
    );

    renderPanel({
      canAdmin: true,
      focal: createCitizenRow({ id: FOCAL_CITIZEN_ID }),
    });

    const user = userEvent.setup();
    const dissolveButton = await screen.findByRole("button", {
      name: "Dissolve",
    });
    await waitFor(() => {
      expect(dissolveButton).not.toBeDisabled();
    });
    await user.click(dissolveButton);

    const form = await screen.findByRole("form", {
      name: "Dissolve partnership",
    });
    const reasonInput = within(form).getByLabelText("Change reason");
    await user.type(reasonInput, "Mutual separation.");
    await user.click(within(form).getByRole("button", { name: "Dissolve" }));

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith("dissolve_partnership", {
        p_change_reason: "Mutual separation.",
        p_ended_on_turn_number: 9,
        p_partnership_id: PARTNERSHIP_ID,
        p_turn_transition_id: TURN_TRANSITION_ID,
      });
    });
  });

  it("rejects the dissolve form without a change reason without calling the RPC", async () => {
    const rpc = vi.fn();
    requireSupabaseClient.mockReturnValue(
      createClient({
        partnerships: [
          createPartnershipRow({
            citizen_a_id: FOCAL_CITIZEN_ID,
            citizen_b_id: PARTNER_CITIZEN_ID,
            id: PARTNERSHIP_ID,
            status: "active",
          }),
        ],
        citizens: [
          createCitizenRow({ id: FOCAL_CITIZEN_ID }),
          createCitizenRow({ id: PARTNER_CITIZEN_ID, name: "Brann" }),
        ],
        currentTurnNumber: 9,
        latestTransitionId: TURN_TRANSITION_ID,
        rpc,
      }),
    );

    renderPanel({
      canAdmin: true,
      focal: createCitizenRow({ id: FOCAL_CITIZEN_ID }),
    });

    const user = userEvent.setup();
    const dissolveButton = await screen.findByRole("button", {
      name: "Dissolve",
    });
    await waitFor(() => {
      expect(dissolveButton).not.toBeDisabled();
    });
    await user.click(dissolveButton);

    const form = await screen.findByRole("form", {
      name: "Dissolve partnership",
    });
    await user.click(within(form).getByRole("button", { name: "Dissolve" }));

    expect(within(form).getByText("Change reason is required.")).toBeDefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("dispatches mark_partnership_widowed when the widowed form is submitted", async () => {
    const rpc = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: createPartnershipRow({
          citizen_a_id: FOCAL_CITIZEN_ID,
          citizen_b_id: PARTNER_CITIZEN_ID,
          ended_on_turn_number: 9,
          id: PARTNERSHIP_ID,
          status: "widowed",
        }),
        error: null,
      }),
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        partnerships: [
          createPartnershipRow({
            citizen_a_id: FOCAL_CITIZEN_ID,
            citizen_b_id: PARTNER_CITIZEN_ID,
            id: PARTNERSHIP_ID,
            status: "active",
          }),
        ],
        citizens: [
          createCitizenRow({ id: FOCAL_CITIZEN_ID }),
          createCitizenRow({ id: PARTNER_CITIZEN_ID, name: "Brann" }),
        ],
        currentTurnNumber: 9,
        latestTransitionId: TURN_TRANSITION_ID,
        rpc,
      }),
    );

    renderPanel({
      canAdmin: true,
      focal: createCitizenRow({ id: FOCAL_CITIZEN_ID }),
    });

    const user = userEvent.setup();
    const widowedButton = await screen.findByRole("button", {
      name: "Mark widowed",
    });
    await waitFor(() => {
      expect(widowedButton).not.toBeDisabled();
    });
    await user.click(widowedButton);

    const form = await screen.findByRole("form", { name: "Mark widowed" });
    await user.type(
      within(form).getByLabelText("Change reason"),
      "Partner died in winter.",
    );
    await user.click(
      within(form).getByRole("button", { name: "Mark widowed" }),
    );

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith("mark_partnership_widowed", {
        p_change_reason: "Partner died in winter.",
        p_ended_on_turn_number: 9,
        p_partnership_id: PARTNERSHIP_ID,
        p_turn_transition_id: TURN_TRANSITION_ID,
      });
    });
  });

  it("rejects the dissolve form when end turn is before the formed turn", async () => {
    const rpc = vi.fn();
    requireSupabaseClient.mockReturnValue(
      createClient({
        partnerships: [
          createPartnershipRow({
            citizen_a_id: FOCAL_CITIZEN_ID,
            citizen_b_id: PARTNER_CITIZEN_ID,
            formed_on_turn_number: 5,
            id: PARTNERSHIP_ID,
            status: "active",
          }),
        ],
        citizens: [
          createCitizenRow({ id: FOCAL_CITIZEN_ID }),
          createCitizenRow({ id: PARTNER_CITIZEN_ID, name: "Brann" }),
        ],
        currentTurnNumber: 9,
        latestTransitionId: TURN_TRANSITION_ID,
        rpc,
      }),
    );

    renderPanel({
      canAdmin: true,
      focal: createCitizenRow({ id: FOCAL_CITIZEN_ID }),
    });

    const user = userEvent.setup();
    const dissolveButton = await screen.findByRole("button", {
      name: "Dissolve",
    });
    await waitFor(() => {
      expect(dissolveButton).not.toBeDisabled();
    });
    await user.click(dissolveButton);

    const form = await screen.findByRole("form", {
      name: "Dissolve partnership",
    });
    const endTurnInput = within(form).getByLabelText("Ended on turn");
    await user.clear(endTurnInput);
    await user.type(endTurnInput, "3");
    await user.click(within(form).getByRole("button", { name: "Dissolve" }));

    expect(
      within(form).getByText(
        "End turn must be on or after the formed turn (turn 5).",
      ),
    ).toBeDefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects the reassign form when end turn is before the old partnership formed turn", async () => {
    const rpc = vi.fn();
    requireSupabaseClient.mockReturnValue(
      createClient({
        partnerships: [
          createPartnershipRow({
            citizen_a_id: FOCAL_CITIZEN_ID,
            citizen_b_id: PARTNER_CITIZEN_ID,
            formed_on_turn_number: 5,
            id: PARTNERSHIP_ID,
            status: "active",
          }),
        ],
        citizens: [
          createCitizenRow({ id: FOCAL_CITIZEN_ID }),
          createCitizenRow({ id: PARTNER_CITIZEN_ID, name: "Brann" }),
          createCitizenRow({ id: THIRD_CITIZEN_ID, name: "Corvin" }),
        ],
        currentTurnNumber: 9,
        latestTransitionId: TURN_TRANSITION_ID,
        rpc,
      }),
    );

    renderPanel({
      canAdmin: true,
      focal: createCitizenRow({ id: FOCAL_CITIZEN_ID }),
    });

    const user = userEvent.setup();
    const reassignButton = await screen.findByRole("button", {
      name: "Reassign",
    });
    await waitFor(() => {
      expect(reassignButton).not.toBeDisabled();
    });
    await user.click(reassignButton);

    const form = await screen.findByRole("form", { name: "Reassign partner" });
    await user.selectOptions(
      within(form).getByLabelText("New partner"),
      THIRD_CITIZEN_ID,
    );
    const endTurnInput = within(form).getByLabelText(
      "Old partnership ended on turn",
    );
    await user.clear(endTurnInput);
    await user.type(endTurnInput, "3");
    await user.click(within(form).getByRole("button", { name: "Reassign" }));

    expect(
      within(form).getByText(
        "Old partnership end turn must be on or after the formed turn (turn 5).",
      ),
    ).toBeDefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("opens the reassign form with new partner and turn fields", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        partnerships: [
          createPartnershipRow({
            citizen_a_id: "c-focal",
            citizen_b_id: "c-partner",
            id: "p-1",
            status: "active",
          }),
        ],
        citizens: [
          createCitizenRow({ id: "c-focal" }),
          createCitizenRow({ id: "c-partner", name: "Brann" }),
        ],
        currentTurnNumber: 9,
        latestTransitionId: "tt-1",
      }),
    );

    renderPanel({ canAdmin: true });

    const user = userEvent.setup();
    const reassignButton = await screen.findByRole("button", {
      name: "Reassign",
    });
    await waitFor(() => {
      expect(reassignButton).not.toBeDisabled();
    });
    await user.click(reassignButton);

    const form = await screen.findByRole("form", { name: "Reassign partner" });
    expect(within(form).getByLabelText("New partner")).toBeDefined();
    expect(
      within(form).getByLabelText("Old partnership ended on turn"),
    ).toBeDefined();
    expect(
      within(form).getByLabelText("New partnership formed on turn"),
    ).toBeDefined();
  });
});

function renderPanel({
  canAdmin,
  focal,
  isArchived = false,
}: {
  readonly canAdmin: boolean;
  readonly focal?: CitizenRowFixture;
  readonly isArchived?: boolean;
}): void {
  const focalCitizen = toCitizenType(
    focal ?? createCitizenRow({ id: "c-focal" }),
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <PartnershipHistoryPanel
        canAdmin={canAdmin}
        citizen={focalCitizen}
        isArchived={isArchived}
      />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function createCitizenRow(
  overrides: Partial<CitizenRowFixture> = {},
): CitizenRowFixture {
  return {
    born_on_turn_number: null,
    citizen_type: "npc",
    created_at: "2026-05-01T00:00:00.000Z",
    death_cause: null,
    death_cause_category: null,
    given_name: "Citizen",
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
    settlement_id: "settlement-1",
    sex: null,
    skills_text: null,
    status: "alive",
    surname: null,
    updated_at: "2026-05-01T00:00:00.000Z",
    user_id: null,
    world_id: "world-1",
    ...overrides,
  };
}

function toCitizenType(row: CitizenRowFixture): Citizen {
  return {
    bornOnTurnNumber: row.born_on_turn_number,
    citizenType: row.citizen_type,
    createdAt: row.created_at,
    deathCause: row.death_cause,
    deathCauseCategory: row.death_cause_category,
    givenName: row.given_name,
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
    surname: row.surname,
    updatedAt: row.updated_at,
    userId: row.user_id,
    worldId: row.world_id,
  };
}

function createPartnershipRow(
  overrides: Partial<PartnershipRowFixture> = {},
): PartnershipRowFixture {
  return {
    change_reason: null,
    changed_by_user_id: null,
    citizen_a_id: "c-focal",
    citizen_b_id: "c-partner",
    created_at: "2026-05-01T00:00:00.000Z",
    ended_on_turn_number: null,
    formed_on_turn_number: 1,
    id: "p-1",
    status: "active",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

type ClientFixtures = {
  readonly partnerships: readonly PartnershipRowFixture[];
  readonly citizens: readonly CitizenRowFixture[];
  readonly currentTurnNumber?: number;
  readonly latestTransitionId?: string | null;
  readonly rpc?: ReturnType<typeof vi.fn>;
};

function createClient({
  partnerships,
  citizens,
  currentTurnNumber = 1,
  latestTransitionId = null,
  rpc,
}: ClientFixtures): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "partnerships") {
        return createPartnershipsBuilder(partnerships);
      }
      if (table === "citizens") {
        return createCitizensBuilder(citizens);
      }
      if (table === "worlds") {
        return createWorldsBuilder(currentTurnNumber);
      }
      if (table === "turn_transitions") {
        return createTurnTransitionsBuilder(latestTransitionId);
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc:
      rpc ??
      vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
  };
}

function createPartnershipsBuilder(
  partnerships: readonly PartnershipRowFixture[],
): unknown {
  return {
    select: vi.fn(() => {
      const filters: Record<string, unknown> = {};
      let inFilter: { column: string; values: readonly string[] } | null = null;

      const builder = {
        eq: vi.fn((column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        }),
        in: vi.fn((column: string, values: readonly string[]) => {
          inFilter = { column, values };
          return builder;
        }),
        returns: vi.fn(() => {
          const filtered = partnerships.filter((row) => {
            if (
              filters["status"] !== undefined &&
              row.status !== filters["status"]
            ) {
              return false;
            }
            if (
              filters["citizen_a_id"] !== undefined &&
              row.citizen_a_id !== filters["citizen_a_id"]
            ) {
              return false;
            }
            if (
              filters["citizen_b_id"] !== undefined &&
              row.citizen_b_id !== filters["citizen_b_id"]
            ) {
              return false;
            }
            if (
              inFilter !== null &&
              !inFilter.values.includes(
                row[inFilter.column as keyof PartnershipRowFixture] as string,
              )
            ) {
              return false;
            }
            return true;
          });
          return Promise.resolve({ data: filtered, error: null });
        }),
        maybeSingle: vi.fn(() => {
          const filtered = partnerships.find((row) => {
            if (
              filters["status"] !== undefined &&
              row.status !== filters["status"]
            ) {
              return false;
            }
            if (
              filters["citizen_a_id"] !== undefined &&
              row.citizen_a_id !== filters["citizen_a_id"]
            ) {
              return false;
            }
            if (
              filters["citizen_b_id"] !== undefined &&
              row.citizen_b_id !== filters["citizen_b_id"]
            ) {
              return false;
            }
            return true;
          });
          return Promise.resolve({ data: filtered ?? null, error: null });
        }),
      };
      return builder;
    }),
  };
}

function createCitizensBuilder(
  citizens: readonly CitizenRowFixture[],
): unknown {
  return {
    select: vi.fn(() => {
      const filters: Record<string, unknown> = {};

      const builder = {
        eq: vi.fn((column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        }),
        order: vi.fn(() => builder),
        returns: vi.fn(() => {
          const filtered = citizens.filter((row) => {
            for (const [column, value] of Object.entries(filters)) {
              if (row[column as keyof CitizenRowFixture] !== value) {
                return false;
              }
            }
            return true;
          });
          return Promise.resolve({ data: filtered, error: null });
        }),
        maybeSingle: vi.fn(() => {
          const filtered = citizens.find((row) => {
            for (const [column, value] of Object.entries(filters)) {
              if (row[column as keyof CitizenRowFixture] !== value) {
                return false;
              }
            }
            return true;
          });
          return Promise.resolve({ data: filtered ?? null, error: null });
        }),
      };
      return builder;
    }),
  };
}

function createWorldsBuilder(currentTurnNumber: number): unknown {
  return {
    select: vi.fn(() => {
      const builder = {
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(() =>
          Promise.resolve({
            data: {
              calendar_config_json: {
                dateFormatTemplate: "{year}-{month}-{day}",
                months: [{ index: 0, name: "Firstmonth", dayCount: 30 }],
                startingDayOfMonth: 1,
                startingMonthIndex: 0,
                startingWeekdayOffset: 0,
                startingYear: 1,
                weekdays: [{ index: 0, name: "Day" }],
              },
              current_turn_number: currentTurnNumber,
            },
            error: null,
          }),
        ),
      };
      return builder;
    }),
  };
}

function createTurnTransitionsBuilder(
  latestTransitionId: string | null,
): unknown {
  return {
    select: vi.fn(() => {
      const builder = {
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        maybeSingle: vi.fn(() =>
          Promise.resolve({
            data:
              latestTransitionId === null
                ? null
                : {
                    finished_at: "2026-05-01T00:00:00.000Z",
                    from_turn_number: 1,
                    id: latestTransitionId,
                    started_at: "2026-05-01T00:00:00.000Z",
                    status: "completed",
                    to_turn_number: 2,
                    world_id: "world-1",
                  },
            error: null,
          }),
        ),
      };
      return builder;
    }),
  };
}
