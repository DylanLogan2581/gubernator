import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivePlayerCharacterContextValue } from "@/features/permissions";

import { NationOfficesSection } from "./OfficesSection";

import type { Nation, NationGovernmentType } from "../../types/nationTypes";
import type { ReactNode } from "react";

// jsdom lacks pointer capture / scrollIntoView, which Radix Select needs to open.
/* eslint-disable @typescript-eslint/unbound-method */
Element.prototype.hasPointerCapture ??= function hasPointerCapture() {
  return false;
};
Element.prototype.setPointerCapture ??= function setPointerCapture() {};
Element.prototype.releasePointerCapture ??= function releasePointerCapture() {};
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
/* eslint-enable @typescript-eslint/unbound-method */

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn<(message: string) => void>(),
  toastSuccess: vi.fn<(message: string) => void>(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
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

type CitizenRow = {
  readonly id: string;
  readonly name: string;
  readonly status: "alive" | "dead";
  readonly citizen_type: "npc" | "player_character";
};

describe("NationOfficesSection", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    useActivePlayerCharacterMock.mockReset();
    useActivePlayerCharacterMock.mockReturnValue({
      activeCharacter: null,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    });
  });

  it("groups the roster by office type and shows an empty state for offices with no holders", async () => {
    requireSupabaseClient.mockReturnValue(
      createClientFixture({
        citizens: [
          {
            id: "citizen-1",
            name: "Senator Bram",
            status: "alive",
            citizen_type: "npc",
          },
        ],
        offices: [
          {
            id: "office-1",
            world_id: "world-1",
            nation_id: "nation-1",
            office_type: "senator",
            citizen_id: "citizen-1",
            appointed_turn_number: 3,
          },
        ],
      }).client,
    );

    renderOfficesSection({
      canAdminWorld: true,
      nation: createNation("republic"),
    });

    expect(await screen.findByText("Senator Bram")).toBeDefined();
    expect(screen.getByText("Senator")).toBeDefined();
    expect(screen.getByText("No treasurer appointed.")).toBeDefined();
    expect(screen.getByText("No bank governor appointed.")).toBeDefined();
  });

  it("hides write controls for a non-manager viewer", async () => {
    requireSupabaseClient.mockReturnValue(
      createClientFixture({
        citizens: [
          {
            id: "citizen-1",
            name: "Senator Bram",
            status: "alive",
            citizen_type: "npc",
          },
        ],
        offices: [
          {
            id: "office-1",
            world_id: "world-1",
            nation_id: "nation-1",
            office_type: "senator",
            citizen_id: "citizen-1",
            appointed_turn_number: 3,
          },
        ],
      }).client,
    );

    renderOfficesSection({
      canAdminWorld: false,
      nation: createNation("republic"),
    });

    expect(await screen.findByText("Senator Bram")).toBeDefined();
    expect(
      screen.queryByRole("button", { name: "Appoint office holder" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  it("appoints an eligible citizen to an allowed office and refreshes the roster", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      citizens: [
        {
          id: "citizen-1",
          name: "Senator Bram",
          status: "alive",
          citizen_type: "npc",
        },
        {
          id: "citizen-2",
          name: "Aria Fenwick",
          status: "alive",
          citizen_type: "player_character",
        },
      ],
      offices: [
        {
          id: "office-1",
          world_id: "world-1",
          nation_id: "nation-1",
          office_type: "senator",
          citizen_id: "citizen-1",
          appointed_turn_number: 3,
        },
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderOfficesSection({
      canAdminWorld: true,
      nation: createNation("republic"),
    });

    await user.click(
      await screen.findByRole("button", { name: "Appoint office holder" }),
    );

    const citizenCombobox = screen.getByRole("combobox", { name: "Citizen" });
    await user.click(citizenCombobox);

    // The current senator (citizen-1) must not appear as a candidate for
    // the same office; only the other alive citizen is selectable.
    expect(
      await screen.findByRole("option", { name: "Aria Fenwick" }),
    ).toBeDefined();
    expect(screen.queryByRole("option", { name: "Senator Bram" })).toBeNull();

    await user.click(screen.getByRole("option", { name: "Aria Fenwick" }));
    await user.click(screen.getByRole("button", { name: "Appoint" }));

    await waitFor(() => {
      expect(clientFixture.rpc).toHaveBeenCalledWith("appoint_nation_office", {
        p_citizen_id: "citizen-2",
        p_nation_id: "nation-1",
        p_office_type: "senator",
      });
    });
  });

  it("dismisses an office holder after confirmation", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      citizens: [
        {
          id: "citizen-1",
          name: "Senator Bram",
          status: "alive",
          citizen_type: "npc",
        },
      ],
      offices: [
        {
          id: "office-1",
          world_id: "world-1",
          nation_id: "nation-1",
          office_type: "senator",
          citizen_id: "citizen-1",
          appointed_turn_number: 3,
        },
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderOfficesSection({
      canAdminWorld: true,
      nation: createNation("republic"),
    });

    await user.click(await screen.findByRole("button", { name: "Dismiss" }));

    const confirmDialog = await screen.findByRole("alertdialog");
    await user.click(
      within(confirmDialog).getByRole("button", { name: "Dismiss" }),
    );

    await waitFor(() => {
      expect(clientFixture.rpc).toHaveBeenCalledWith("dismiss_nation_office", {
        p_office_id: "office-1",
      });
    });
  });
});

function renderOfficesSection({
  canAdminWorld,
  isArchived = false,
  nation,
}: {
  readonly canAdminWorld: boolean;
  readonly isArchived?: boolean;
  readonly nation: Nation;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <NationOfficesSection
        canAdminWorld={canAdminWorld}
        isArchived={isArchived}
        nation={nation}
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
    isHidden: false,
    name: "Ironhaven",
    namesetId: null,
    taxRate: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
    worldId: "world-1",
  };
}

function createClientFixture({
  citizens,
  offices,
}: {
  readonly citizens: readonly CitizenRow[];
  readonly offices: readonly {
    readonly id: string;
    readonly world_id: string;
    readonly nation_id: string;
    readonly office_type: string;
    readonly citizen_id: string;
    readonly appointed_turn_number: number;
  }[];
}): { readonly client: unknown; readonly rpc: ReturnType<typeof vi.fn> } {
  const rpc = vi.fn((name: string) => {
    if (name === "appoint_nation_office") {
      return Promise.resolve({ data: null, error: null });
    }
    if (name === "dismiss_nation_office") {
      return Promise.resolve({ data: null, error: null });
    }
    throw new Error(`Unexpected rpc ${name}`);
  });

  const from = vi.fn((table: string) => {
    if (table === "nation_offices") {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: offices, error: null }),
        }),
      };
    }
    if (table === "citizen_directory_view") {
      return {
        select: () => ({
          in: () =>
            Promise.resolve({
              data: citizens.map((citizen) => ({
                id: citizen.id,
                name: citizen.name,
                citizen_type: citizen.citizen_type,
              })),
              error: null,
            }),
        }),
      };
    }
    if (table === "settlements") {
      return {
        select: () => ({
          eq: () =>
            withReturns({ data: [{ id: "settlement-1" }], error: null }),
        }),
      };
    }
    if (table === "citizens") {
      return {
        select: () => ({
          in: () => ({
            or: () => ({
              order: () => ({
                order: () =>
                  withReturns({
                    data: citizens.map((citizen) => toCitizenRow(citizen)),
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "worlds") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { client: { from, rpc }, rpc };
}

// The real supabase-js query builder exposes a type-only `.returns<T>()`
// method after `.eq()`/`.order()` that just returns `this`; tests need to
// tolerate that chained call even though these fixtures are plain promises.
function withReturns<T>(result: T): Promise<T> & { returns: () => Promise<T> } {
  const promise = Promise.resolve(result) as Promise<T> & {
    returns: () => Promise<T>;
  };
  promise.returns = () => promise;
  return promise;
}

function toCitizenRow(citizen: CitizenRow): Record<string, unknown> {
  return {
    id: citizen.id,
    world_id: "world-1",
    settlement_id: "settlement-1",
    citizen_type: citizen.citizen_type,
    given_name: citizen.name,
    surname: null,
    name: citizen.name,
    nameset_id: null,
    sex: null,
    status: citizen.status,
    born_on_turn_number: null,
    parent_a_citizen_id: null,
    parent_b_citizen_id: null,
    user_id: null,
    profile_photo_url: null,
    role_type: "none",
    role_nation_id: null,
    role_settlement_id: null,
    death_cause: null,
    death_cause_category: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}
