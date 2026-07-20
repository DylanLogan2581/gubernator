import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivePlayerCharacterContextValue } from "@/features/permissions";

import { NationTreasurySection } from "./TreasurySection";

import type { Nation } from "../../types/nationTypes";

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

const { notifyMutationError, notifyMutationSuccess } = vi.hoisted(() => ({
  notifyMutationError: vi.fn<(error: unknown, fallback: string) => void>(),
  notifyMutationSuccess: vi.fn<(message: string) => void>(),
}));

vi.mock("@/lib/notify", () => ({
  notifyMutationError,
  notifyMutationSuccess,
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

describe("NationTreasurySection", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    notifyMutationError.mockReset();
    notifyMutationSuccess.mockReset();
    useActivePlayerCharacterMock.mockReset();
    useActivePlayerCharacterMock.mockReturnValue({
      activeCharacter: null,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    });
  });

  it("renders the stockpile table and a placeholder estimate before any snapshot exists", async () => {
    requireSupabaseClient.mockReturnValue(
      createClientFixture({
        stockpile: [
          {
            resource_id: "44444444-4444-4444-4444-444444444444",
            quantity: 40,
            name: "Grain",
          },
        ],
      }).client,
    );

    render(
      <TestHarness>
        <NationTreasurySection
          canAdminWorld={false}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    expect(await screen.findByText("Grain")).toBeDefined();
    expect(screen.getByText("40")).toBeDefined();
    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === "P" &&
          (element.textContent ?? "").includes(
            "Estimated next-turn intake: No tax snapshot since the current rate was set",
          ),
      ),
    ).toBeDefined();
  });

  it("hides grant/subsidize controls and disables the tax slider for a non-manager viewer", async () => {
    requireSupabaseClient.mockReturnValue(
      createClientFixture({ stockpile: [] }).client,
    );

    render(
      <TestHarness>
        <NationTreasurySection
          canAdminWorld={false}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    await screen.findByText("No resources");
    expect(
      screen.queryByRole("button", { name: "Grant resources" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Subsidize construction" }),
    ).toBeNull();
    expect(screen.getByRole("slider")).toHaveAttribute("data-disabled", "");
  });

  it("grants resources to a settlement and reports the result", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlements: [
        { id: "33333333-3333-3333-3333-333333333333", name: "Ironhaven Keep" },
      ],
      stockpile: [
        {
          resource_id: "44444444-4444-4444-4444-444444444444",
          quantity: 40,
          name: "Grain",
        },
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    render(
      <TestHarness>
        <NationTreasurySection
          canAdminWorld={true}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Grant resources" }),
    );

    await user.click(screen.getByRole("combobox", { name: "Settlement" }));
    await user.click(
      await screen.findByRole("option", { name: "Ironhaven Keep" }),
    );

    await user.click(screen.getByRole("combobox", { name: "Resource" }));
    await user.click(await screen.findByRole("option", { name: /Grain/ }));

    await user.type(screen.getByLabelText(/Quantity/), "10");
    await user.click(screen.getByRole("button", { name: "Grant" }));

    await waitFor(() => {
      expect(clientFixture.rpc).toHaveBeenCalledWith("grant_nation_resources", {
        p_nation_id: "11111111-1111-1111-1111-111111111111",
        p_quantity: 10,
        p_resource_id: "44444444-4444-4444-4444-444444444444",
        p_settlement_id: "33333333-3333-3333-3333-333333333333",
      });
    });
    await waitFor(() => {
      expect(notifyMutationSuccess).toHaveBeenCalledWith("Granted 10.");
    });
  });

  it("commits a tax rate change on slider release", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({ stockpile: [] });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    render(
      <TestHarness>
        <NationTreasurySection
          canAdminWorld={true}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    const slider = await screen.findByRole("slider");
    slider.focus();
    await user.keyboard("{ArrowRight}");

    await waitFor(() => {
      expect(clientFixture.rpc).toHaveBeenCalledWith("set_nation_tax_rate", {
        p_nation_id: "11111111-1111-1111-1111-111111111111",
        p_rate: 0.11,
      });
    });
  });

  it("subsidizes an active construction project", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      projects: [
        {
          id: "55555555-5555-5555-5555-555555555555",
          settlement_id: "33333333-3333-3333-3333-333333333333",
          settlement_name: "Ironhaven Keep",
          blueprint_name: "Granary",
          tier_number: 1,
          costs: [
            { resource_id: "44444444-4444-4444-4444-444444444444", amount: 20 },
          ],
        },
      ],
      resources: [
        { id: "44444444-4444-4444-4444-444444444444", name: "Grain" },
      ],
      stockpile: [
        {
          resource_id: "44444444-4444-4444-4444-444444444444",
          quantity: 20,
          name: "Grain",
        },
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    render(
      <TestHarness>
        <NationTreasurySection
          canAdminWorld={true}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Subsidize construction" }),
    );

    await user.click(
      screen.getByRole("combobox", { name: "Construction project" }),
    );
    await user.click(
      await screen.findByRole("option", { name: /Ironhaven Keep/ }),
    );

    await user.click(screen.getByRole("button", { name: "Subsidize" }));

    await waitFor(() => {
      expect(clientFixture.rpc).toHaveBeenCalledWith(
        "subsidize_construction_project",
        {
          p_nation_id: "11111111-1111-1111-1111-111111111111",
          p_project_id: "55555555-5555-5555-5555-555555555555",
        },
      );
    });
  });

  it("shows a warning when nation stockpile is insufficient for the selected project", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      projects: [
        {
          id: "55555555-5555-5555-5555-555555555555",
          settlement_id: "33333333-3333-3333-3333-333333333333",
          settlement_name: "Ironhaven Keep",
          blueprint_name: "Granary",
          tier_number: 1,
          costs: [
            { resource_id: "44444444-4444-4444-4444-444444444444", amount: 20 },
          ],
        },
      ],
      resources: [
        { id: "44444444-4444-4444-4444-444444444444", name: "Grain" },
      ],
      stockpile: [
        {
          resource_id: "44444444-4444-4444-4444-444444444444",
          quantity: 5,
          name: "Grain",
        },
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    render(
      <TestHarness>
        <NationTreasurySection
          canAdminWorld={true}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Subsidize construction" }),
    );

    await user.click(
      screen.getByRole("combobox", { name: "Construction project" }),
    );
    await user.click(
      await screen.findByRole("option", { name: /Ironhaven Keep/ }),
    );

    expect(
      await screen.findByText(/Nation stockpile is insufficient/),
    ).toBeDefined();
  });

  it("disables subsidize when the nation stockpile holds none of the required resources", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      projects: [
        {
          id: "55555555-5555-5555-5555-555555555555",
          settlement_id: "33333333-3333-3333-3333-333333333333",
          settlement_name: "Ironhaven Keep",
          blueprint_name: "Granary",
          tier_number: 1,
          costs: [
            { resource_id: "44444444-4444-4444-4444-444444444444", amount: 20 },
          ],
        },
      ],
      resources: [
        { id: "44444444-4444-4444-4444-444444444444", name: "Grain" },
      ],
      stockpile: [],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    render(
      <TestHarness>
        <NationTreasurySection
          canAdminWorld={true}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Subsidize construction" }),
    );

    await user.click(
      screen.getByRole("combobox", { name: "Construction project" }),
    );
    await user.click(
      await screen.findByRole("option", { name: /Ironhaven Keep/ }),
    );

    expect(await screen.findByText(/would transfer nothing/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Subsidize" })).toBeDisabled();
  });

  it("hides the quantity field in the grant dialog when the nation holds no resources", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlements: [
        { id: "33333333-3333-3333-3333-333333333333", name: "Ironhaven Keep" },
      ],
      stockpile: [],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    render(
      <TestHarness>
        <NationTreasurySection
          canAdminWorld={true}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Grant resources" }),
    );

    await screen.findByText("The nation does not hold any resources to grant.");
    expect(screen.queryByLabelText(/Quantity/)).toBeNull();
  });

  it("lists active subsidies with committed vs required amounts and progress", async () => {
    const clientFixture = createClientFixture({
      resources: [
        { id: "44444444-4444-4444-4444-444444444444", name: "Grain" },
      ],
      stockpile: [],
      subsidies: [
        {
          project_id: "55555555-5555-5555-5555-555555555555",
          settlement_id: "33333333-3333-3333-3333-333333333333",
          settlement_name: "Ironhaven Keep",
          blueprint_name: "Granary",
          tier_number: 1,
          resource_id: "44444444-4444-4444-4444-444444444444",
          granted_quantity: 10,
          costs: [
            { resource_id: "44444444-4444-4444-4444-444444444444", amount: 20 },
          ],
        },
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    render(
      <TestHarness>
        <NationTreasurySection
          canAdminWorld={false}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    expect(await screen.findByText("Ironhaven Keep")).toBeDefined();
    expect(screen.getByText(/Granary \(tier 1\)/)).toBeDefined();
    expect(screen.getByText("10 / 20 Grain")).toBeDefined();
    expect(screen.getByText("50%")).toBeDefined();
  });
});

function TestHarness({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <QueryClientProvider client={createQueryClient()}>
      {children}
    </QueryClientProvider>
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

function createNation(): Nation {
  return {
    capitalSettlementId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    flagPath: null,
    foundedTurnNumber: null,
    governmentType: "monarchy",
    id: "11111111-1111-1111-1111-111111111111",
    name: "Ironhaven",
    namesetId: null,
    primaryCultureId: null,
    stateReligionId: null,
    taxRate: 0.1,
    tradePolicy: "free",
    updatedAt: "2026-01-01T00:00:00.000Z",
    worldId: "22222222-2222-2222-2222-222222222222",
  };
}

function chain<T>(result: T): {
  readonly eq: () => ReturnType<typeof chain<T>>;
  readonly in: () => ReturnType<typeof chain<T>>;
  readonly limit: () => ReturnType<typeof chain<T>>;
  readonly maybeSingle: () => Promise<T>;
  readonly order: () => ReturnType<typeof chain<T>>;
  readonly returns: () => ReturnType<typeof chain<T>>;
  readonly select: () => ReturnType<typeof chain<T>>;
  readonly single: () => Promise<T>;
  readonly then: <TResult>(
    onFulfilled: (value: T) => TResult,
  ) => Promise<TResult>;
} {
  const self = {
    eq: () => self,
    in: () => self,
    limit: () => self,
    maybeSingle: () => Promise.resolve(result),
    order: () => self,
    returns: () => self,
    select: () => self,
    single: () => Promise.resolve(result),
    then: <TResult,>(onFulfilled: (value: T) => TResult) =>
      Promise.resolve(result).then(onFulfilled),
  };
  return self;
}

function rpcChain<T>(result: T): {
  readonly single: () => Promise<T>;
  readonly then: <TResult>(
    onFulfilled: (value: T) => TResult,
  ) => Promise<TResult>;
} {
  return {
    single: () => Promise.resolve(result),
    then: <TResult,>(onFulfilled: (value: T) => TResult) =>
      Promise.resolve(result).then(onFulfilled),
  };
}

function createClientFixture({
  projects = [],
  resources = [],
  settlements = [],
  stockpile,
  subsidies = [],
}: {
  readonly projects?: readonly {
    readonly blueprint_name: string;
    readonly costs: readonly {
      readonly amount: number;
      readonly resource_id: string;
    }[];
    readonly id: string;
    readonly settlement_id: string;
    readonly settlement_name: string;
    readonly tier_number: number;
  }[];
  readonly resources?: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly settlements?: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly stockpile: readonly {
    readonly name: string;
    readonly quantity: number;
    readonly resource_id: string;
  }[];
  readonly subsidies?: readonly {
    readonly blueprint_name: string;
    readonly costs: readonly {
      readonly amount: number;
      readonly resource_id: string;
    }[];
    readonly granted_quantity: number;
    readonly project_id: string;
    readonly resource_id: string;
    readonly settlement_id: string;
    readonly settlement_name: string;
    readonly tier_number: number;
  }[];
}): { readonly client: unknown; readonly rpc: ReturnType<typeof vi.fn> } {
  const rpc = vi.fn((name: string) => {
    if (name === "grant_nation_resources") {
      return rpcChain({
        data: { clamped: false, granted_quantity: 10 },
        error: null,
      });
    }
    if (name === "subsidize_construction_project") {
      return rpcChain({
        data: [
          {
            clamped: false,
            granted_quantity: 20,
            resource_id: "44444444-4444-4444-4444-444444444444",
          },
        ],
        error: null,
      });
    }
    if (name === "set_nation_tax_rate") {
      return rpcChain({ data: null, error: null });
    }
    if (name === "settlement_alive_citizen_counts_batch") {
      return Promise.resolve({
        data: settlements.map((settlement) => ({
          alive_citizen_count: 0,
          settlement_id: settlement.id,
        })),
        error: null,
      });
    }
    throw new Error(`Unexpected rpc ${name}`);
  });

  const from = vi.fn((table: string) => {
    if (table === "nation_resource_stockpiles") {
      return chain({
        data: stockpile.map((entry) => ({
          quantity: entry.quantity,
          resource_id: entry.resource_id,
          resources: { is_system_resource: false, name: entry.name },
        })),
        error: null,
      });
    }
    if (table === "nation_turn_snapshots") {
      return chain({ data: null, error: null });
    }
    if (table === "settlements") {
      return chain({
        data: settlements.map((settlement) => ({
          auto_ready_enabled: false,
          id: settlement.id,
          is_ready_current_turn: false,
          last_ready_at: null,
          name: settlement.name,
          nation_id: "11111111-1111-1111-1111-111111111111",
          nations: { name: "Ironhaven" },
          ready_set_at: null,
        })),
        error: null,
      });
    }
    if (table === "construction_projects") {
      return chain({
        data: projects.map((project) => ({
          building_blueprint_tiers: {
            construction_costs_json: project.costs,
            tier_number: project.tier_number,
          },
          building_blueprints: { name: project.blueprint_name },
          id: project.id,
          settlement_id: project.settlement_id,
          settlements: {
            name: project.settlement_name,
            nation_id: "11111111-1111-1111-1111-111111111111",
          },
        })),
        error: null,
      });
    }
    if (table === "resources") {
      return chain({ data: resources, error: null });
    }
    if (table === "construction_project_subsidies") {
      return chain({
        data: subsidies.map((subsidy) => ({
          construction_projects: {
            building_blueprint_tiers: {
              construction_costs_json: subsidy.costs,
              tier_number: subsidy.tier_number,
            },
            building_blueprints: { name: subsidy.blueprint_name },
            settlement_id: subsidy.settlement_id,
            settlements: {
              name: subsidy.settlement_name,
              nation_id: "11111111-1111-1111-1111-111111111111",
            },
          },
          granted_quantity: subsidy.granted_quantity,
          project_id: subsidy.project_id,
          resource_id: subsidy.resource_id,
        })),
        error: null,
      });
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { client: { from, rpc }, rpc };
}
