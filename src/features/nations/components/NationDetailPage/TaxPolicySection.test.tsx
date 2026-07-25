import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivePlayerCharacterContextValue } from "@/features/permissions";

import { NationTaxPolicySection } from "./TaxPolicySection";

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

vi.mock("@/lib/notify", () => ({
  notifyMutationError: vi.fn(),
  notifyMutationSuccess: vi.fn(),
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

describe("NationTaxPolicySection", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    useActivePlayerCharacterMock.mockReset();
    useActivePlayerCharacterMock.mockReturnValue({
      activeCharacter: null,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    });
  });

  it("renders the default rule editor and demand-tribute action for a manager", async () => {
    requireSupabaseClient.mockReturnValue(
      createClientFixture({
        policies: [
          {
            exempt: false,
            flat_amount: 0,
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            method: "percent_production",
            min_stockpile_floor: 0,
            nation_id: "11111111-1111-1111-1111-111111111111",
            rate: 0.1,
            settlement_id: null,
            taxed_resource_ids: null,
          },
        ],
      }),
    );

    render(
      <TestHarness>
        <NationTaxPolicySection
          canAdminWorld={true}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    expect(await screen.findByText("Default rule")).toBeDefined();
    expect(
      await screen.findByRole("button", { name: "Save default rule" }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Demand tribute" }),
    ).toBeDefined();
  });

  it("hides editing controls for a non-manager viewer", async () => {
    requireSupabaseClient.mockReturnValue(
      createClientFixture({ policies: [] }),
    );

    render(
      <TestHarness>
        <NationTaxPolicySection
          canAdminWorld={false}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    expect(await screen.findByText("Default rule")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Demand tribute" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Save default rule" }),
    ).toBeNull();
    expect(
      screen.getByText(
        "You do not have permission to edit this nation's tax policy.",
      ),
    ).toBeDefined();
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
    sealPath: null,
    stateReligionId: null,
    taxRate: 0.1,
    tradePolicy: "free",
    updatedAt: "2026-01-01T00:00:00.000Z",
    worldId: "22222222-2222-2222-2222-222222222222",
  };
}

function chain<T>(result: T): unknown {
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

function createClientFixture({
  policies,
}: {
  readonly policies: readonly {
    readonly exempt: boolean;
    readonly flat_amount: number;
    readonly id: string;
    readonly method: string;
    readonly min_stockpile_floor: number;
    readonly nation_id: string;
    readonly rate: number;
    readonly settlement_id: string | null;
    readonly taxed_resource_ids: string[] | null;
  }[];
}): unknown {
  const from = vi.fn((table: string) => {
    if (table === "nation_tax_policies") {
      return chain({ data: policies, error: null });
    }
    if (table === "settlements") {
      return chain({ data: [], error: null });
    }
    if (table === "resources") {
      return chain({ data: [], error: null });
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { from, rpc: vi.fn() };
}
