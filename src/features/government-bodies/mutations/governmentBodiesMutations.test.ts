import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  deleteGovernmentBodyMutationOptions,
  isGovernmentBodyMutationError,
} from "./governmentBodiesMutations";

describe("deleteGovernmentBodyMutationOptions", () => {
  it("rejects a malformed id before deleting", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = deleteGovernmentBodyMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        id: "not-a-uuid",
        nationId: null,
        settlementId: null,
      }),
    ).rejects.toSatisfy(isGovernmentBodyMutationError);
    expect(from).not.toHaveBeenCalled();
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

function executeMutation<TOptions extends { mutationFn?: unknown }>(
  queryClient: QueryClient,
  options: TOptions,
  variables: unknown,
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options as never)
    .execute(variables);
}
