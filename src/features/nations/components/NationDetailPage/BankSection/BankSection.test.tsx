import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivePlayerCharacterContextValue } from "@/features/permissions";

import { NationBankSection } from "./index";

import type { Nation } from "../../../types/nationTypes";

// jsdom lacks pointer capture / scrollIntoView, which Radix Select/RadioGroup need.
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

describe("NationBankSection", () => {
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

  it("shows an empty state without an establish CTA for a plain member", async () => {
    requireSupabaseClient.mockReturnValue(
      createClientFixture({ currency: null }).client,
    );

    render(
      <TestHarness>
        <NationBankSection
          canAdminWorld={false}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    await screen.findByText("No currency established");
    expect(
      screen.queryByRole("button", { name: "Establish a currency" }),
    ).toBeNull();
  });

  it("lets a world admin establish a fiat currency", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({ currency: null });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    render(
      <TestHarness>
        <NationBankSection
          canAdminWorld={true}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Establish a currency" }),
    );

    await user.type(screen.getByLabelText("Name"), "Ironhaven Crown");
    await user.type(screen.getByLabelText("Symbol"), "IHC");
    await user.click(screen.getByRole("button", { name: "Establish" }));

    await waitFor(() => {
      expect(clientFixture.rpc).toHaveBeenCalledWith(
        "establish_nation_currency",
        {
          p_backing_ratio: undefined,
          p_backing_resource_id: undefined,
          p_name: "Ironhaven Crown",
          p_nation_id: "nation-1",
          p_symbol: "IHC",
          p_type: "fiat",
        },
      );
    });
  });

  it("renders stat tiles and ledger, hiding action buttons for a non-manager viewer", async () => {
    const clientFixture = createClientFixture({
      currency: {
        confidence: 0.8,
        currency_type: "fiat",
        money_supply: 1000,
      },
      ledger: [
        {
          action: "mint",
          amount: 500,
          id: "ledger-1",
          resource_amount: null,
          turn_number: 3,
        },
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    render(
      <TestHarness>
        <NationBankSection
          canAdminWorld={false}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    expect(await screen.findByText("Ironhaven Crown (IHC)")).toBeDefined();
    expect(screen.getByText("1,000")).toBeDefined();
    expect(screen.getByText("80%")).toBeDefined();
    expect(await screen.findByText("Mint")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Mint" })).toBeNull();
  });

  it("mints currency for a nation manager and shows the confidence preview", async () => {
    const user = userEvent.setup();
    useActivePlayerCharacterMock.mockReturnValue({
      activeCharacter: {
        id: "citizen-1",
        roleNationId: "nation-1",
        roleSettlementId: null,
        roleType: "nation_manager",
        status: "alive",
      } as ActivePlayerCharacterContextValue["activeCharacter"],
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    });
    const clientFixture = createClientFixture({
      currency: {
        confidence: 0.8,
        currency_type: "fiat",
        money_supply: 1000,
      },
      ledger: [],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    render(
      <TestHarness>
        <NationBankSection
          canAdminWorld={false}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    await user.click(await screen.findByRole("button", { name: "Mint" }));
    await user.type(screen.getByLabelText(/Amount \(IHC\)/), "100");

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          (element.textContent ?? "").includes("Confidence impact next turn:"),
      ),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Mint" }));

    await waitFor(() => {
      expect(clientFixture.rpc).toHaveBeenCalledWith("mint_currency", {
        p_amount: 100,
        p_currency_id: "currency-1",
      });
    });
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
    id: "nation-1",
    name: "Ironhaven",
    namesetId: null,
    taxRate: 0.1,
    tradePolicy: "free",
    updatedAt: "2026-01-01T00:00:00.000Z",
    worldId: "world-1",
  };
}

function chain<T>(result: T): {
  readonly eq: () => ReturnType<typeof chain<T>>;
  readonly in: () => ReturnType<typeof chain<T>>;
  readonly limit: () => ReturnType<typeof chain<T>>;
  readonly maybeSingle: () => Promise<T>;
  readonly order: () => ReturnType<typeof chain<T>>;
  readonly range: () => ReturnType<typeof chain<T>>;
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
    range: () => self,
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
  currency,
  ledger = [],
}: {
  readonly currency: {
    readonly confidence: number;
    readonly currency_type: string;
    readonly money_supply: number;
  } | null;
  readonly ledger?: readonly {
    readonly action: string;
    readonly amount: number | null;
    readonly id: string;
    readonly resource_amount: number | null;
    readonly turn_number: number;
  }[];
}): { readonly client: unknown; readonly rpc: ReturnType<typeof vi.fn> } {
  const currencyRow =
    currency === null
      ? null
      : {
          backing_ratio: null,
          backing_resource_id: null,
          confidence: currency.confidence,
          created_at: "2026-01-01T00:00:00.000Z",
          currency_type: currency.currency_type,
          established_turn_number: 1,
          id: "currency-1",
          money_supply: currency.money_supply,
          name: "Ironhaven Crown",
          nation_id: "nation-1",
          reserve_quantity: 0,
          symbol: "IHC",
          updated_at: "2026-01-01T00:00:00.000Z",
          world_id: "world-1",
        };

  const rpc = vi.fn((name: string) => {
    if (name === "establish_nation_currency") {
      return rpcChain({
        data: {
          backing_ratio: null,
          backing_resource_id: null,
          confidence: 1,
          currency_type: "fiat",
          established_turn_number: 1,
          id: "currency-1",
          money_supply: 0,
          name: "Ironhaven Crown",
          nation_id: "nation-1",
          reserve_quantity: 0,
          symbol: "IHC",
          world_id: "world-1",
        },
        error: null,
      });
    }
    if (name === "mint_currency") {
      return rpcChain({ data: currencyRow, error: null });
    }
    throw new Error(`Unexpected rpc ${name}`);
  });

  const from = vi.fn((table: string) => {
    if (table === "nation_currencies") {
      return chain({ data: currencyRow, error: null });
    }
    if (table === "nation_currency_snapshots") {
      return chain({ data: [], error: null });
    }
    if (table === "nation_currency_ledger") {
      return chain({ count: ledger.length, data: ledger, error: null });
    }
    if (table === "citizen_directory_view") {
      return chain({ data: [], error: null });
    }
    if (table === "nation_offices") {
      return chain({ data: [], error: null });
    }
    if (table === "nations") {
      return chain({ data: { treasury_currency: 750 }, error: null });
    }
    if (table === "resources") {
      return chain({ data: null, error: null });
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { client: { from, rpc }, rpc };
}
