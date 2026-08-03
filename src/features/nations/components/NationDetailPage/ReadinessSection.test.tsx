import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivePlayerCharacterContextValue } from "@/features/permissions";

import { NationReadinessSection } from "./ReadinessSection";

import type { Nation, NationGovernmentType } from "../../types/nationTypes";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const { toastError } = vi.hoisted(() => ({
  toastError: vi.fn<(message: string) => void>(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: vi.fn(),
  },
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
  };
});

describe("NationReadinessSection", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    useActivePlayerCharacterMock.mockReset();
    useActivePlayerCharacterMock.mockReturnValue({
      activeCharacter: null,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    });
  });

  it("renders a single toggle for ruler_only nations", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      citizenRows: [{ id: "citizen-ruler", name: "Queen Aeva" }],
      eligibleVoterIds: ["citizen-ruler"],
      voteRows: [],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderReadinessSection({
      effectiveCanAdmin: true,
      nation: createNation("monarchy"),
    });

    expect(await screen.findByText("Queen Aeva")).toBeDefined();
    const toggle = screen.getByRole("switch", { name: "Ready" });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    await waitFor(() => {
      expect(clientFixture.rpc).toHaveBeenCalledWith(
        "cast_nation_readiness_vote",
        {
          p_nation_id: "nation-1",
          p_vote: true,
          p_voter_citizen_id: "citizen-ruler",
        },
      );
    });
  });

  it("shows an empty state when the ruler has not been assigned", async () => {
    requireSupabaseClient.mockReturnValue(
      createClientFixture({
        citizenRows: [],
        eligibleVoterIds: [],
        voteRows: [],
      }).client,
    );

    renderReadinessSection({
      effectiveCanAdmin: true,
      nation: createNation("monarchy"),
    });

    expect(await screen.findByText("No ruler assigned")).toBeDefined();
  });

  it("renders a majority voter list with progress and lets an admin vote for an npc senator", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      citizenRows: [
        { id: "citizen-1", name: "Senator Bram" },
        { id: "citizen-2", name: "Senator Aria" },
      ],
      eligibleVoterIds: ["citizen-1", "citizen-2"],
      voteRows: [{ vote: true, voter_citizen_id: "citizen-1" }],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderReadinessSection({
      effectiveCanAdmin: true,
      nation: createNation("republic"),
    });

    expect(await screen.findByText("1/2 senators ready")).toBeDefined();

    const ariaRow = screen.getByText("Senator Aria").closest("li");
    expect(ariaRow).not.toBeNull();
    const ariaReadyButton = ariaRow?.querySelector("button");
    expect(ariaReadyButton).toHaveTextContent("Ready");

    if (ariaReadyButton !== null && ariaReadyButton !== undefined) {
      await user.click(ariaReadyButton);
    }

    await waitFor(() => {
      expect(clientFixture.rpc).toHaveBeenCalledWith(
        "cast_nation_readiness_vote",
        {
          p_nation_id: "nation-1",
          p_vote: true,
          p_voter_citizen_id: "citizen-2",
        },
      );
    });
  });

  it("hides vote buttons for a viewer who is not an admin or the voter's own character", async () => {
    requireSupabaseClient.mockReturnValue(
      createClientFixture({
        citizenRows: [{ id: "citizen-1", name: "Elder Bram" }],
        eligibleVoterIds: ["citizen-1"],
        voteRows: [],
      }).client,
    );

    renderReadinessSection({
      effectiveCanAdmin: false,
      nation: createNation("tribal_council"),
    });

    expect(await screen.findByText("Elder Bram")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Ready" })).toBeNull();
    expect(screen.getByText("Awaiting vote")).toBeDefined();
  });

  it("shows vote buttons for a player's own active character", async () => {
    const user = userEvent.setup();
    useActivePlayerCharacterMock.mockReturnValue({
      activeCharacter: {
        id: "citizen-1",
        status: "alive",
      } as ActivePlayerCharacterContextValue["activeCharacter"],
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    });
    const clientFixture = createClientFixture({
      citizenRows: [
        { id: "citizen-1", name: "Manager Bram" },
        { id: "citizen-2", name: "Manager Aria" },
      ],
      eligibleVoterIds: ["citizen-1", "citizen-2"],
      voteRows: [],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderReadinessSection({
      effectiveCanAdmin: false,
      nation: createNation("confederation"),
    });

    expect(await screen.findByText("Manager Bram")).toBeDefined();
    const bramRow = screen.getByText("Manager Bram").closest("li");
    const ariaRow = screen.getByText("Manager Aria").closest("li");
    expect(bramRow).not.toBeNull();
    expect(ariaRow).not.toBeNull();
    // Only the viewer's own PC (Bram) gets vote buttons; Aria is read-only.
    expect(bramRow?.querySelector("button")?.textContent).toBe("Ready");
    expect(ariaRow?.querySelector("button")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Not ready" }));

    await waitFor(() => {
      expect(clientFixture.rpc).toHaveBeenCalledWith(
        "cast_nation_readiness_vote",
        {
          p_nation_id: "nation-1",
          p_vote: false,
          p_voter_citizen_id: "citizen-1",
        },
      );
    });
  });

  it("shows an error toast when the vote mutation fails", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      castError: { code: "42501", message: "not an eligible voter" },
      citizenRows: [{ id: "citizen-ruler", name: "Queen Aeva" }],
      eligibleVoterIds: ["citizen-ruler"],
      voteRows: [],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderReadinessSection({
      effectiveCanAdmin: true,
      nation: createNation("monarchy"),
    });

    await user.click(await screen.findByRole("switch", { name: "Ready" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("not an eligible voter"),
      );
    });
  });
});

function renderReadinessSection({
  effectiveCanAdmin,
  isArchived = false,
  nation,
}: {
  readonly effectiveCanAdmin: boolean;
  readonly isArchived?: boolean;
  readonly nation: Nation;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <NationReadinessSection
        currentTurnNumber={4}
        effectiveCanAdmin={effectiveCanAdmin}
        isArchived={isArchived}
        nation={nation}
        worldId="world-1"
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

function createNation(governmentType: NationGovernmentType): Nation {
  return {
    capitalSettlementId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    flagPath: null,
    foundedTurnNumber: null,
    governmentType,
    id: "nation-1",
    name: "Ironhaven",
    namesetId: null,
    primaryCultureId: null,
    sealPath: null,
    stateReligionId: null,
    taxRate: 0,
    tradePolicy: "free",
    updatedAt: "2026-01-01T00:00:00.000Z",
    worldId: "world-1",
  };
}

function createClientFixture({
  castError = null,
  citizenRows,
  eligibleVoterIds,
  voteRows,
}: {
  readonly castError?: {
    readonly code?: string;
    readonly message: string;
  } | null;
  readonly citizenRows: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly eligibleVoterIds: readonly string[];
  readonly voteRows: readonly {
    readonly vote: boolean;
    readonly voter_citizen_id: string;
  }[];
}): { readonly client: unknown; readonly rpc: ReturnType<typeof vi.fn> } {
  const rpc = vi.fn((name: string) => {
    if (name === "nation_readiness_eligible_voter_ids") {
      return Promise.resolve({ data: eligibleVoterIds, error: null });
    }
    if (name === "cast_nation_readiness_vote") {
      return {
        single: vi.fn().mockResolvedValue(
          castError !== null
            ? { data: null, error: castError }
            : {
                data: {
                  cast_by_user_id: "user-1",
                  created_at: "2026-05-02T12:00:00.000Z",
                  id: "vote-1",
                  nation_id: "nation-1",
                  turn_number: 4,
                  vote: true,
                  voter_citizen_id: "citizen-ruler",
                },
                error: null,
              },
        ),
      };
    }
    throw new Error(`Unexpected rpc ${name}`);
  });
  const from = vi.fn((table: string) => {
    if (table === "citizen_directory_view") {
      return {
        select: () => ({
          in: () => Promise.resolve({ data: citizenRows, error: null }),
        }),
      };
    }
    if (table === "nation_readiness_votes") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: voteRows, error: null }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { client: { from, rpc }, rpc };
}
