import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createOfficeTypeMutationOptions,
  isOfficeTypeMutationError,
  updateOfficeTypeMutationOptions,
} from "./officeTypesMutations";

const NATION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const WORLD_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OFFICE_TYPE_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("createOfficeTypeMutationOptions", () => {
  it("rejects a blank name before writing", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createOfficeTypeMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        excludesFromLabor: false,
        name: "   ",
        nationId: null,
        scope: "nation",
        worldId: WORLD_ID,
      }),
    ).rejects.toSatisfy(isOfficeTypeMutationError);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an invalid scope before writing", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createOfficeTypeMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        excludesFromLabor: false,
        name: "Governor",
        nationId: null,
        scope: "world",
        worldId: WORLD_ID,
      }),
    ).rejects.toSatisfy(isOfficeTypeMutationError);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("updateOfficeTypeMutationOptions", () => {
  it("rejects a non-positive maxHolders before writing", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateOfficeTypeMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        id: OFFICE_TYPE_ID,
        maxHolders: 0,
        nationId: NATION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toSatisfy(isOfficeTypeMutationError);
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
