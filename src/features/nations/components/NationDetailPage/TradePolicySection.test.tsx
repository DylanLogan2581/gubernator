import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivePlayerCharacterContextValue } from "@/features/permissions";

import { NationTradePolicySection } from "./TradePolicySection";

import type { Nation, NationTradePolicy } from "../../types/nationTypes";

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

describe("NationTradePolicySection", () => {
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

  it("shows the current policy as read-only text for a non-manager", async () => {
    render(
      <TestHarness>
        <NationTradePolicySection
          canAdminWorld={false}
          isArchived={false}
          nation={createNation({ tradePolicy: "state_controlled" })}
        />
      </TestHarness>,
    );

    expect(await screen.findByText("State-controlled")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("International trade posture"),
    ).not.toBeInTheDocument();
  });

  it("renders an editable select for a world admin", async () => {
    render(
      <TestHarness>
        <NationTradePolicySection
          canAdminWorld={true}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    expect(
      await screen.findByLabelText("International trade posture"),
    ).toHaveValue("free");
  });

  it("submits a policy change through set_nation_trade_policy", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture("closed");
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    render(
      <TestHarness>
        <NationTradePolicySection
          canAdminWorld={true}
          isArchived={false}
          nation={createNation()}
        />
      </TestHarness>,
    );

    const select = await screen.findByLabelText("International trade posture");
    await user.selectOptions(select, "closed");

    await waitFor(() => {
      expect(clientFixture.rpc).toHaveBeenCalledWith(
        "set_nation_trade_policy",
        {
          p_nation_id: "11111111-1111-1111-1111-111111111111",
          p_trade_policy: "closed",
        },
      );
    });
    await waitFor(() => {
      expect(notifyMutationSuccess).toHaveBeenCalledWith(
        "Trade policy updated.",
      );
    });
  });

  it("disables the select for an archived world", async () => {
    render(
      <TestHarness>
        <NationTradePolicySection
          canAdminWorld={true}
          isArchived={true}
          nation={createNation()}
        />
      </TestHarness>,
    );

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("International trade posture"),
    ).not.toBeInTheDocument();
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

function createNation(overrides: Partial<Nation> = {}): Nation {
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
    taxRate: 0,
    tradePolicy: "free",
    updatedAt: "2026-01-01T00:00:00.000Z",
    worldId: "world-1",
    ...overrides,
  };
}

function createClientFixture(nextTradePolicy: NationTradePolicy): {
  readonly client: unknown;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { ...createNationRow(), trade_policy: nextTradePolicy },
    error: null,
  });
  const rpc = vi.fn(() => ({ maybeSingle }));
  return { client: { rpc }, rpc };
}

function createNationRow(): Record<string, unknown> {
  return {
    capital_settlement_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    description: null,
    flag_path: null,
    founded_turn_number: null,
    government_type: "monarchy",
    id: "11111111-1111-1111-1111-111111111111",
    name: "Ironhaven",
    nameset_id: null,
    tax_rate: 0,
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: "world-1",
  };
}
