import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { nationDiscoveriesQueryOptions } from "./nationDiscoveryQueries";

describe("nationDiscoveriesQueryOptions", () => {
  it("maps nation_discoveries rows for the world", async () => {
    const client = createClient({
      data: [
        {
          nation_a_id: "nation-1",
          nation_b_id: "nation-2",
          met_at_turn_number: 5,
          created_by_user_id: "user-1",
        },
      ],
      error: null,
    });
    const queryClient = createQueryClient();

    const discoveries = await queryClient.fetchQuery(
      nationDiscoveriesQueryOptions("world-1", client),
    );

    expect(discoveries).toEqual([
      {
        createdByUserId: "user-1",
        metAtTurnNumber: 5,
        nationAId: "nation-1",
        nationBId: "nation-2",
      },
    ]);
  });

  it("throws a normalized error when the query fails", async () => {
    const client = createClient({
      data: null,
      error: { code: "42501", message: "not allowed" },
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(nationDiscoveriesQueryOptions("world-1", client)),
    ).rejects.toThrow("not allowed");
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function createClient({
  data,
  error,
}: {
  readonly data: unknown;
  readonly error: { readonly code?: string; readonly message: string } | null;
}): GubernatorSupabaseClient {
  const returns = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ returns }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return { from } as unknown as GubernatorSupabaseClient;
}
