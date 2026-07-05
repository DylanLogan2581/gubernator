import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { citizensByIdsQueryOptions } from "./citizensQueries";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
}

type MockBuilder = {
  readonly eq: ReturnType<typeof vi.fn>;
  readonly in: ReturnType<typeof vi.fn>;
  readonly returns: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
};

function createClient(rows: unknown[]): {
  readonly client: GubernatorSupabaseClient;
  readonly builder: MockBuilder;
} {
  const builder = {
    eq: vi.fn(),
    in: vi.fn(),
    returns: vi.fn(),
    select: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.returns.mockResolvedValue({ data: rows, error: null });

  return {
    client: {
      from: vi.fn().mockReturnValue(builder),
    } as unknown as GubernatorSupabaseClient,
    builder,
  };
}

describe("citizensByIdsQueryOptions", () => {
  it("looks up citizens by id in one query and maps them to Citizen", async () => {
    const { client, builder } = createClient([
      {
        id: "citizen-1",
        world_id: "world-1",
        settlement_id: null,
        citizen_type: "npc",
        given_name: "Alice",
        surname: null,
        name: "Alice",
        nameset_id: null,
        sex: null,
        status: "alive",
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
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ]);

    const queryClient = createQueryClient();
    const citizens = await queryClient.fetchQuery(
      citizensByIdsQueryOptions(["citizen-1"], client),
    );

    expect(builder.in).toHaveBeenCalledWith("id", ["citizen-1"]);
    expect(citizens).toHaveLength(1);
    expect(citizens[0]?.name).toBe("Alice");
  });

  it("does not query when given an empty id list", async () => {
    const { client, builder } = createClient([]);

    const queryClient = createQueryClient();
    const citizens = await queryClient.fetchQuery(
      citizensByIdsQueryOptions([], client),
    );

    expect(citizens).toEqual([]);
    expect(builder.in).not.toHaveBeenCalled();
  });
});
