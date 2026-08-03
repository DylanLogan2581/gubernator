import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CitizenPlayerCharacterSection } from "./PlayerCharacterSection";

import type { Citizen } from "../../types/citizenTypes";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000010";
const USER_ID = "00000000-0000-0000-0000-000000000099";

describe("CitizenPlayerCharacterSection linked-user readout", () => {
  it("shows Not set for a genuinely unlinked citizen", () => {
    requireSupabaseClient.mockReturnValue(createClient({ data: [] }));

    renderSection(createCitizen({ userId: null }), { canAdmin: true });

    expect(screen.getByText("Not set")).toBeDefined();
  });

  it("hides the linked user from non-admins instead of showing Not set", () => {
    requireSupabaseClient.mockReturnValue(createClient({ data: [] }));

    renderSection(createCitizen({ userId: USER_ID }), { canAdmin: false });

    expect(screen.getByText("Linked user hidden")).toBeDefined();
    expect(screen.queryByText("Not set")).toBeNull();
  });

  it("shows the linked user's name for admins once the lookup resolves", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ data: [{ id: USER_ID, username: "Ada" }] }),
    );

    renderSection(createCitizen({ userId: USER_ID }), { canAdmin: true });

    expect(await screen.findByText("Ada")).toBeDefined();
  });

  it("shows a retryable error state when the lookup fails, not Not set", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ error: { message: "boom" } }),
    );

    renderSection(createCitizen({ userId: USER_ID }), { canAdmin: true });

    expect(await screen.findByText("Couldn't load linked user.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
    expect(screen.queryByText("Not set")).toBeNull();
  });
});

function renderSection(
  citizen: Citizen,
  options: { readonly canAdmin: boolean },
): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <CitizenPlayerCharacterSection
        canAdmin={options.canAdmin}
        canEdit={options.canAdmin}
        citizen={citizen}
        queryClient={createQueryClient()}
      />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function createCitizen(overrides: Partial<Citizen> = {}): Citizen {
  return {
    bornOnTurnNumber: 1,
    citizenType: "player_character",
    createdAt: "2026-05-01T00:00:00.000Z",
    cultureId: null,
    deathCause: null,
    deathCauseCategory: null,
    educationLevelId: null,
    givenName: "Citizen",
    id: "citizen-1",
    name: "Citizen",
    namesetId: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    profilePhotoUrl: null,
    religionId: null,
    roleNationId: null,
    roleSettlementId: null,
    roleType: "none",
    settlementId: null,
    sex: null,
    status: "alive",
    surname: null,
    updatedAt: "2026-05-01T00:00:00.000Z",
    userId: null,
    worldId: WORLD_ID,
    ...overrides,
  };
}

function createClient(response: {
  readonly data?: readonly unknown[];
  readonly error?: { readonly message: string };
}): unknown {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: response.data ?? null,
      error: response.error ?? null,
    }),
  };
}
