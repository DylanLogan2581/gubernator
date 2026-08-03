import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  castNationReadinessVoteMutationOptions,
  type CastNationReadinessVoteInput,
  type CastNationReadinessVoteMutationOptions,
} from "./nationReadinessVoteMutations";

describe("castNationReadinessVoteMutationOptions", () => {
  it("casts a readiness vote and invalidates readiness list and voter queries", async () => {
    const clientFixture = createClient({
      rpcResult: {
        data: {
          cast_by_user_id: "user-1",
          created_at: "2026-05-02T12:00:00.000Z",
          id: "vote-1",
          nation_id: "nation-1",
          turn_number: 4,
          vote: true,
          voter_citizen_id: "citizen-1",
        },
        error: null,
      },
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = castNationReadinessVoteMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      nationId: "nation-1",
      turnNumber: 4,
      vote: true,
      voterCitizenId: "citizen-1",
      worldId: "world-1",
    });

    expect(result).toEqual({
      castByUserId: "user-1",
      nationId: "nation-1",
      turnNumber: 4,
      vote: true,
      voterCitizenId: "citizen-1",
    });
    expect(clientFixture.rpc).toHaveBeenCalledWith(
      "cast_nation_readiness_vote",
      {
        p_nation_id: "nation-1",
        p_vote: true,
        p_voter_citizen_id: "citizen-1",
      },
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "readiness", "list", "world-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "readiness", "voters", "nation-1", 4],
    });
  });

  it("throws a normalized error when the vote is rejected", async () => {
    const clientFixture = createClient({
      rpcResult: {
        data: null,
        error: { code: "42501", message: "not an eligible voter" },
      },
    });
    const queryClient = createQueryClient();
    const options = castNationReadinessVoteMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        nationId: "nation-1",
        turnNumber: 4,
        vote: true,
        voterCitizenId: "citizen-2",
        worldId: "world-1",
      }),
    ).rejects.toThrow("not an eligible voter");
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function executeMutation(
  queryClient: QueryClient,
  options: CastNationReadinessVoteMutationOptions,
  variables: CastNationReadinessVoteInput,
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}

function createClient({
  rpcResult,
}: {
  readonly rpcResult: {
    readonly data: unknown;
    readonly error: { readonly code?: string; readonly message: string } | null;
  };
}): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const single = vi.fn().mockResolvedValue(rpcResult);
  const rpc = vi.fn(() => ({ single }));
  const client = { rpc } as unknown as GubernatorSupabaseClient;

  return { client, rpc };
}
