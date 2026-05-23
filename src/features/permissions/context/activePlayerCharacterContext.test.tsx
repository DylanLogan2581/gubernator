import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useActivePlayerCharacter } from "./activePlayerCharacterContext";
import { ActivePlayerCharacterProvider } from "./ActivePlayerCharacterProvider";

import type { JSX } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

describe("useActivePlayerCharacter", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("returns empty defaults when used outside a provider", () => {
    render(<ContextProbe />);

    expect(screen.getByTestId("active")).toHaveTextContent("none");
    expect(screen.getByTestId("selectable-count")).toHaveTextContent("0");
    expect(screen.getByTestId("pending")).toHaveTextContent("no");
  });

  it("returns empty selectable + null active for a world admin with no player character", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ activeRow: null, selectableRows: [] }),
    );

    renderWithProvider({ userId: "admin-user", worldId: "world-1" });

    await waitFor(() => {
      expect(screen.getByTestId("pending")).toHaveTextContent("no");
    });
    expect(screen.getByTestId("active")).toHaveTextContent("none");
    expect(screen.getByTestId("selectable-count")).toHaveTextContent("0");
  });

  it("resolves activeCharacter from the active row + selectable list", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        activeRow: {
          citizen_id: "citizen-2",
          updated_at: "2026-05-22T00:00:00.000Z",
          user_id: "user-1",
          world_id: "world-1",
        },
        selectableRows: [
          createCitizenRow({ id: "citizen-1", name: "Alice" }),
          createCitizenRow({ id: "citizen-2", name: "Bob" }),
        ],
      }),
    );

    renderWithProvider({ userId: "user-1", worldId: "world-1" });

    await waitFor(() => {
      expect(screen.getByTestId("active")).toHaveTextContent("citizen-2");
    });
    expect(screen.getByTestId("selectable-count")).toHaveTextContent("2");
  });

  it("leaves activeCharacter null when no row exists but selectable PCs are available", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        activeRow: null,
        selectableRows: [createCitizenRow({ id: "citizen-1", name: "Alice" })],
      }),
    );

    renderWithProvider({ userId: "user-1", worldId: "world-1" });

    await waitFor(() => {
      expect(screen.getByTestId("selectable-count")).toHaveTextContent("1");
    });
    expect(screen.getByTestId("active")).toHaveTextContent("none");
  });

  it("does not query when userId is null", () => {
    const from = vi.fn();
    requireSupabaseClient.mockReturnValue({ from });

    renderWithProvider({ userId: null, worldId: "world-1" });

    expect(screen.getByTestId("active")).toHaveTextContent("none");
    expect(screen.getByTestId("selectable-count")).toHaveTextContent("0");
    expect(screen.getByTestId("pending")).toHaveTextContent("no");
    expect(from).not.toHaveBeenCalled();
  });
});

function ContextProbe(): JSX.Element {
  const value = useActivePlayerCharacter();
  return (
    <ul>
      <li data-testid="active">
        {value.activeCharacter === null ? "none" : value.activeCharacter.id}
      </li>
      <li data-testid="selectable-count">
        {value.selectableCharacters.length}
      </li>
      <li data-testid="pending">{value.isPending ? "yes" : "no"}</li>
    </ul>
  );
}

function renderWithProvider({
  userId,
  worldId,
}: {
  readonly userId: string | null;
  readonly worldId: string;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ActivePlayerCharacterProvider userId={userId} worldId={worldId}>
        <ContextProbe />
      </ActivePlayerCharacterProvider>
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

type ActiveRowFixture = {
  readonly citizen_id: string;
  readonly updated_at: string;
  readonly user_id: string;
  readonly world_id: string;
};

function createClient({
  activeRow,
  selectableRows,
}: {
  readonly activeRow: ActiveRowFixture | null;
  readonly selectableRows: readonly Record<string, unknown>[];
}): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "citizens") {
        return {
          select: vi.fn(() => createSelectableChain(selectableRows)),
        };
      }
      if (table === "user_active_player_characters") {
        return {
          select: vi.fn(() => createActiveRowChain(activeRow)),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createSelectableChain(
  rows: readonly Record<string, unknown>[],
): unknown {
  const returns = vi.fn().mockResolvedValue({ data: rows, error: null });
  const order2 = vi.fn(() => ({ returns }));
  const order1 = vi.fn(() => ({ order: order2 }));
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn(() => chain);
  chain.order = order1;
  return chain;
}

function createActiveRowChain(row: ActiveRowFixture | null): unknown {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq2 = vi.fn(() => ({ maybeSingle }));
  const eq1 = vi.fn(() => ({ eq: eq2 }));
  return { eq: eq1 };
}

function createCitizenRow(
  overrides: Partial<{ readonly id: string; readonly name: string }> = {},
): Record<string, unknown> {
  return {
    born_on_turn_number: 1,
    citizen_type: "player_character",
    created_at: "2026-05-01T00:00:00.000Z",
    death_cause: null,
    id: overrides.id ?? "citizen-1",
    name: overrides.name ?? "Alice",
    npc_flaw: null,
    npc_goal: null,
    npc_secret_contradiction: null,
    npc_trait_1: null,
    npc_trait_2: null,
    parent_a_citizen_id: null,
    parent_b_citizen_id: null,
    personality_text: null,
    profile_photo_url: null,
    role_nation_id: null,
    role_settlement_id: null,
    role_type: "none",
    settlement_id: "settlement-1",
    sex: null,
    skills_text: null,
    status: "alive",
    updated_at: "2026-05-01T00:00:00.000Z",
    user_id: "user-1",
    world_id: "world-1",
  };
}
