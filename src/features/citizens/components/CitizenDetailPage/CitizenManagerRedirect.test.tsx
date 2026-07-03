import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActivePlayerCharacterContext } from "@/features/permissions";
import type { ActivePlayerCharacterContextValue } from "@/features/permissions";

import { CitizenManagerRedirect } from "./CitizenManagerRedirect";

import type { Citizen } from "../../types/citizenTypes";
import type { ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    ...rest
  }: {
    readonly children: ReactNode;
    readonly [key: string]: unknown;
  }) => <a {...rest}>{children}</a>,
  useNavigate: () => navigate,
}));

describe("CitizenManagerRedirect", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    navigate.mockReset();
    requireSupabaseClient.mockReturnValue(createSettlementClient(null));
  });

  it("names the active-character suppression for an admin acting as another citizen", () => {
    const citizen = createCitizen({ settlementId: "settlement-1" });
    const activeCharacter = createCitizen({
      id: "pc-1",
      name: "Aria",
    });
    requireSupabaseClient.mockReturnValue(
      createSettlementClient({
        id: "settlement-1",
        name: "Riverbend",
        nationId: "nation-1",
      }),
    );

    renderRedirect({ activeCharacter, canAdmin: true, citizen });

    expect(
      screen.getByText(
        "Admin access is paused while you're acting as Aria. Clear your active character to edit this citizen.",
      ),
    ).toBeDefined();
  });

  it("explains the manager-only restriction for non-admin managers", () => {
    const citizen = createCitizen({ settlementId: "settlement-1" });
    const activeCharacter = createCitizen({
      id: "pc-1",
      name: "Aria",
      roleType: "settlement_manager",
      roleSettlementId: "settlement-1",
    });
    requireSupabaseClient.mockReturnValue(
      createSettlementClient({
        id: "settlement-1",
        name: "Riverbend",
        nationId: "nation-1",
      }),
    );

    renderRedirect({ activeCharacter, canAdmin: false, citizen });

    expect(
      screen.getByText(
        "Nation and settlement managers manage citizens from the settlement detail screen. Redirecting now…",
      ),
    ).toBeDefined();
  });

  it("explains the missing settlement assignment before any manager/admin check", () => {
    const citizen = createCitizen({ settlementId: null });

    renderRedirect({ activeCharacter: null, canAdmin: true, citizen });

    expect(
      screen.getByText(
        "This citizen has not been assigned to a settlement yet.",
      ),
    ).toBeDefined();
  });
});

function renderRedirect({
  activeCharacter,
  canAdmin,
  citizen,
}: {
  readonly activeCharacter: Citizen | null;
  readonly canAdmin: boolean;
  readonly citizen: Citizen;
}): ReturnType<typeof render> {
  const value: ActivePlayerCharacterContextValue = {
    activeCharacter,
    clear: vi.fn(),
    isPending: false,
    selectableCharacters: activeCharacter === null ? [] : [activeCharacter],
    switchTo: vi.fn(),
  };

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ActivePlayerCharacterContext value={value}>
        <CitizenManagerRedirect
          canAdmin={canAdmin}
          citizen={citizen}
          worldId="world-1"
        />
      </ActivePlayerCharacterContext>
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

function createCitizen(overrides: Partial<Citizen>): Citizen {
  return {
    bornOnTurnNumber: null,
    citizenType: "player_character",
    createdAt: "2026-05-01T00:00:00.000Z",
    deathCause: null,
    deathCauseCategory: null,
    givenName: "Player",
    id: "pc-1",
    name: "Player",
    namesetId: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    profilePhotoUrl: null,
    roleNationId: null,
    roleSettlementId: null,
    roleType: "none",
    settlementId: null,
    sex: null,
    status: "alive",
    surname: null,
    updatedAt: "2026-05-01T00:00:00.000Z",
    userId: "user-1",
    worldId: "world-1",
    ...overrides,
  } satisfies Citizen;
}

function createSettlementClient(
  settlement: { id: string; name: string; nationId: string } | null,
): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "settlements") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data:
                  settlement === null
                    ? null
                    : {
                        coord_x: null,
                        coord_z: null,
                        created_at: "2026-01-01T00:00:00.000Z",
                        description: null,
                        id: settlement.id,
                        name: settlement.name,
                        nameset_id: null,
                        nation_id: settlement.nationId,
                        nations: {
                          id: settlement.nationId,
                          name: "Nation",
                          nameset_id: null,
                          world_id: "world-1",
                        },
                        updated_at: "2026-01-01T00:00:00.000Z",
                      },
                error: null,
              }),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}
