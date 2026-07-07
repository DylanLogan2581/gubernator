import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CitizenSiblingNav } from "./CitizenSiblingNav";

import type { Citizen } from "../../types/citizenTypes";
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
  }: {
    readonly children: ReactNode;
    readonly to: string;
    readonly params?: Readonly<Record<string, string>>;
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
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000010";
const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000030";

describe("CitizenSiblingNav", () => {
  it("renders nothing when the citizen has no settlement", () => {
    requireSupabaseClient.mockReturnValue(createClient([]));

    const { container } = renderNav(
      createCitizen({ id: "citizen-1", settlementId: null }),
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the citizen is the only one in the settlement", () => {
    const citizen = createCitizen({ id: "citizen-1", name: "Alone" });
    requireSupabaseClient.mockReturnValue(createClient([citizen]));

    const { container } = renderNav(citizen);

    expect(container.querySelector("nav")).toBeNull();
  });

  it("cycles prev/next within the settlement, wrapping at the ends", async () => {
    const first = createCitizen({ id: "citizen-1", name: "Ada" });
    const second = createCitizen({ id: "citizen-2", name: "Bram" });
    const third = createCitizen({ id: "citizen-3", name: "Cora" });
    requireSupabaseClient.mockReturnValue(createClient([first, second, third]));

    renderNav(second);

    const prevLink = await screen.findByRole("link", { name: /Ada/ });
    const nextLink = screen.getByRole("link", { name: /Cora/ });
    expect((prevLink as HTMLAnchorElement).href).toContain("citizen-1");
    expect((nextLink as HTMLAnchorElement).href).toContain("citizen-3");
    expect(screen.getByText("2 of 3")).toBeDefined();
  });

  it("wraps from the first citizen to the last as the previous link", async () => {
    const first = createCitizen({ id: "citizen-1", name: "Ada" });
    const second = createCitizen({ id: "citizen-2", name: "Bram" });
    requireSupabaseClient.mockReturnValue(createClient([first, second]));

    renderNav(first);

    const links = await screen.findAllByRole("link", { name: /Bram/ });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect((link as HTMLAnchorElement).href).toContain("citizen-2");
    }
  });
});

function renderNav(citizen: Citizen): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <CitizenSiblingNav citizen={citizen} worldId={WORLD_ID} />
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
    citizenType: "npc",
    createdAt: "2026-05-01T00:00:00.000Z",
    deathCause: null,
    deathCauseCategory: null,
    givenName: "Citizen",
    id: "citizen-1",
    name: "Citizen",
    namesetId: null,
    parentACitizenId: null,
    parentBCitizenId: null,
    profilePhotoUrl: null,
    roleNationId: null,
    roleSettlementId: null,
    roleType: "none",
    settlementId: SETTLEMENT_ID,
    sex: null,
    status: "alive",
    surname: null,
    updatedAt: "2026-05-01T00:00:00.000Z",
    userId: null,
    worldId: WORLD_ID,
    ...overrides,
  };
}

function createClient(citizens: readonly Citizen[]): unknown {
  const rows = citizens.map((citizen) => ({
    born_on_turn_number: citizen.bornOnTurnNumber,
    citizen_type: citizen.citizenType,
    created_at: citizen.createdAt,
    death_cause: citizen.deathCause,
    death_cause_category: citizen.deathCauseCategory,
    given_name: citizen.givenName,
    id: citizen.id,
    name: citizen.name,
    nameset_id: citizen.namesetId,
    parent_a_citizen_id: citizen.parentACitizenId,
    parent_b_citizen_id: citizen.parentBCitizenId,
    profile_photo_url: citizen.profilePhotoUrl,
    role_nation_id: citizen.roleNationId,
    role_settlement_id: citizen.roleSettlementId,
    role_type: citizen.roleType,
    settlement_id: citizen.settlementId,
    sex: citizen.sex,
    status: citizen.status,
    surname: citizen.surname,
    updated_at: citizen.updatedAt,
    user_id: citizen.userId,
    world_id: citizen.worldId,
  }));

  return {
    from: vi.fn((table: string) => {
      if (table !== "citizens") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: vi.fn(() => {
          const builder: Record<string, unknown> = {
            eq: vi.fn(() => builder),
            order: vi.fn(() => builder),
            returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
          };
          return builder;
        }),
      };
    }),
  };
}
