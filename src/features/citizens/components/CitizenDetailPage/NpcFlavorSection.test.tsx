import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CitizenNpcFlavorSection } from "./NpcFlavorSection";

import type { Citizen, CitizenAdminDetails } from "../../types/citizenTypes";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000010";

describe("CitizenNpcFlavorSection", () => {
  it("hides the adult trait fields and shows only the disclaimer for a minor", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ minimumPartnershipAgeTurns: 100 }),
    );

    renderSection({ ageTurns: 10 }, createAdminDetails());

    expect(
      await screen.findByText(
        "This citizen is too young for adult flavor text.",
      ),
    ).toBeDefined();
    expect(screen.queryByText("Brave")).toBeNull();
    expect(screen.queryByText("Trait 1")).toBeNull();
    expect(screen.queryByText("Trait 2")).toBeNull();
    expect(screen.queryByText("Goal")).toBeNull();
    expect(screen.queryByText("Flaw")).toBeNull();
    expect(screen.queryByText("Secret / contradiction")).toBeNull();
  });

  it("shows the adult trait fields for an adult citizen", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ minimumPartnershipAgeTurns: 100 }),
    );

    renderSection({ ageTurns: 200 }, createAdminDetails());

    expect(await screen.findByText("Brave")).toBeDefined();
    expect(
      screen.queryByText("This citizen is too young for adult flavor text."),
    ).toBeNull();
  });
});

function renderSection(
  options: { readonly ageTurns: number },
  adminDetails: CitizenAdminDetails,
): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <CitizenNpcFlavorSection
        adminDetails={adminDetails}
        canEdit={false}
        citizen={createCitizen({ bornOnTurnNumber: 0 })}
        currentTurnNumber={options.ageTurns}
        queryClient={createQueryClient()}
        worldId={WORLD_ID}
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
    bornOnTurnNumber: 0,
    citizenType: "npc",
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

function createAdminDetails(
  overrides: Partial<CitizenAdminDetails> = {},
): CitizenAdminDetails {
  return {
    npcFlaw: "Stubborn",
    npcGoal: "Protect the family",
    npcSecretContradiction: "Fears the dark",
    npcTrait1: "Brave",
    npcTrait2: "Loyal",
    personalityText: null,
    skillsText: null,
    ...overrides,
  };
}

function createClient(options: {
  readonly minimumPartnershipAgeTurns: number;
}): unknown {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              fertility_chance: 0,
              food_consumption_per_citizen: 0,
              homelessness_decline_rate: 0,
              incest_prevention_depth: 0,
              maximum_fertility_age_turns: 1000,
              minimum_partnership_age_turns: options.minimumPartnershipAgeTurns,
              mourning_period_turns: 0,
              npc_flavor_config_json: null,
              partnership_seek_chance: 0,
              starvation_severity_multiplier: 0,
              water_consumption_per_citizen: 0,
            },
            error: null,
          }),
        }),
      }),
    }),
  };
}
