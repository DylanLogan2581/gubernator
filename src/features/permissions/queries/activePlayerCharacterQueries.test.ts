import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  activePlayerCharacterRowQueryOptions,
  selectablePlayerCharactersQueryOptions,
} from "./activePlayerCharacterQueries";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

describe("selectablePlayerCharactersQueryOptions", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("filters to alive player characters owned by the user in the world and maps to Citizen", async () => {
    const eqCalls: Array<readonly [string, unknown]> = [];
    const returns = vi
      .fn()
      .mockResolvedValue({ data: [createCitizenRow()], error: null });
    const order2 = vi.fn(() => ({ returns }));
    const order1 = vi.fn(() => ({ order: order2 }));
    const eq = vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return chain;
    });
    const chain: { eq: typeof eq; order: typeof order1 } = {
      eq,
      order: order1,
    };
    const select = vi.fn(() => chain);
    const from = vi.fn(() => ({ select }));
    requireSupabaseClient.mockReturnValue({ from });

    const queryClient = createQueryClient();
    const result = await queryClient.fetchQuery(
      selectablePlayerCharactersQueryOptions("user-1", "world-1"),
    );

    expect(from).toHaveBeenCalledWith("citizens");
    expect(eqCalls).toEqual([
      ["world_id", "world-1"],
      ["user_id", "user-1"],
      ["citizen_type", "player_character"],
      ["status", "alive"],
    ]);
    expect(order1).toHaveBeenCalledWith("name", { ascending: true });
    expect(order2).toHaveBeenCalledWith("id", { ascending: true });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      citizenType: "player_character",
      id: "citizen-1",
      status: "alive",
      userId: "user-1",
      worldId: "world-1",
    });
  });
});

describe("activePlayerCharacterRowQueryOptions", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("returns null when no row exists for the user/world", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = vi.fn(() => ({ maybeSingle }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    requireSupabaseClient.mockReturnValue({
      from: vi.fn(() => ({ select })),
    });

    const queryClient = createQueryClient();
    const result = await queryClient.fetchQuery(
      activePlayerCharacterRowQueryOptions("user-1", "world-1"),
    );

    expect(result).toBeNull();
    expect(eq1).toHaveBeenCalledWith("user_id", "user-1");
    expect(eq2).toHaveBeenCalledWith("world_id", "world-1");
  });

  it("returns the row when present", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        citizen_id: "citizen-1",
        updated_at: "2026-05-22T00:00:00.000Z",
        user_id: "user-1",
        world_id: "world-1",
      },
      error: null,
    });
    const eq2 = vi.fn(() => ({ maybeSingle }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    requireSupabaseClient.mockReturnValue({
      from: vi.fn(() => ({ select })),
    });

    const queryClient = createQueryClient();
    const result = await queryClient.fetchQuery(
      activePlayerCharacterRowQueryOptions("user-1", "world-1"),
    );

    expect(result).toEqual({
      citizenId: "citizen-1",
      updatedAt: "2026-05-22T00:00:00.000Z",
      userId: "user-1",
      worldId: "world-1",
    });
  });
});

function createCitizenRow(): Record<string, unknown> {
  return {
    born_on_turn_number: 1,
    citizen_type: "player_character",
    created_at: "2026-05-01T00:00:00.000Z",
    death_cause: null,
    id: "citizen-1",
    name: "Alice",
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

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}
