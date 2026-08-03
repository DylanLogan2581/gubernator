import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { nationReadinessVotersQueryOptions } from "./nationReadinessVotersQueries";

describe("nationReadinessVotersQueryOptions", () => {
  it("combines eligible voter ids, citizen names, and current-turn votes", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: ["citizen-1", "citizen-2"],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "citizen_directory_view") {
        return createSelectInBuilder({
          data: [
            { id: "citizen-1", name: "Bram Elder" },
            { id: "citizen-2", name: "Aria Elder" },
          ],
          error: null,
        });
      }
      if (table === "nation_readiness_votes") {
        return createVotesBuilder({
          data: [{ voter_citizen_id: "citizen-1", vote: true }],
          error: null,
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const client = { from, rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    const voters = await queryClient.fetchQuery(
      nationReadinessVotersQueryOptions("nation-1", 4, client),
    );

    expect(rpc).toHaveBeenCalledWith("nation_readiness_eligible_voter_ids", {
      p_nation_id: "nation-1",
    });
    expect(voters).toEqual([
      { citizenId: "citizen-2", name: "Aria Elder", vote: null },
      { citizenId: "citizen-1", name: "Bram Elder", vote: true },
    ]);
  });

  it("returns no voters without querying citizens or votes when there are none eligible", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const from = vi.fn();
    const client = { from, rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    const voters = await queryClient.fetchQuery(
      nationReadinessVotersQueryOptions("nation-1", 4, client),
    );

    expect(voters).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("throws a normalized error when the eligible voter rpc fails", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom" } });
    const client = {
      from: vi.fn(),
      rpc,
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        nationReadinessVotersQueryOptions("nation-1", 4, client),
      ),
    ).rejects.toThrow("boom");
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function createSelectInBuilder(result: {
  readonly data: unknown;
  readonly error: unknown;
}): unknown {
  const inFn = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ in: inFn }));
  return { select };
}

function createVotesBuilder(result: {
  readonly data: unknown;
  readonly error: unknown;
}): unknown {
  const eqTurn = vi.fn().mockResolvedValue(result);
  const eqNation = vi.fn(() => ({ eq: eqTurn }));
  const select = vi.fn(() => ({ eq: eqNation }));
  return { select };
}
