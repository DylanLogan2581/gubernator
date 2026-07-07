import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  setNationsMetMutationOptions,
  setNationsUnmetMutationOptions,
  type SetNationsMetInput,
  type SetNationsMetMutationOptions,
  type SetNationsUnmetMutationOptions,
} from "./nationDiscoveryMutations";

describe("setNationsMetMutationOptions", () => {
  it("calls set_nations_met and invalidates the world's discoveries query", async () => {
    const clientFixture = createClient({ error: null });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = setNationsMetMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      nationAId: "nation-1",
      nationBId: "nation-2",
      worldId: "world-1",
    });

    expect(clientFixture.rpc).toHaveBeenCalledWith("set_nations_met", {
      p_a: "nation-1",
      p_b: "nation-2",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "discoveries", "world-1"],
    });
  });

  it("throws a normalized error when the caller is not authorized", async () => {
    const clientFixture = createClient({
      error: { code: "42501", message: "not an admin" },
    });
    const queryClient = createQueryClient();
    const options = setNationsMetMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        nationAId: "nation-1",
        nationBId: "nation-2",
        worldId: "world-1",
      }),
    ).rejects.toThrow("not an admin");
  });
});

describe("setNationsUnmetMutationOptions", () => {
  it("calls set_nations_unmet and invalidates the world's discoveries query", async () => {
    const clientFixture = createClient({ error: null });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = setNationsUnmetMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      nationAId: "nation-1",
      nationBId: "nation-2",
      worldId: "world-1",
    });

    expect(clientFixture.rpc).toHaveBeenCalledWith("set_nations_unmet", {
      p_a: "nation-1",
      p_b: "nation-2",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "discoveries", "world-1"],
    });
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
  options: SetNationsMetMutationOptions | SetNationsUnmetMutationOptions,
  variables: SetNationsMetInput,
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}

function createClient({
  error,
}: {
  readonly error: { readonly code?: string; readonly message: string } | null;
}): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const rpc = vi.fn().mockResolvedValue({ data: null, error });
  const client = { rpc } as unknown as GubernatorSupabaseClient;

  return { client, rpc };
}
