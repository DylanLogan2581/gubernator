import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  grantNationResourcesMutationOptions,
  isTreasuryMutationError,
  setNationTaxRateMutationOptions,
  subsidizeConstructionProjectMutationOptions,
} from "./treasuryMutations";

const NATION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SETTLEMENT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const RESOURCE_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const WORLD_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const PROJECT_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

describe("grantNationResourcesMutationOptions", () => {
  it("rejects a non-positive quantity before calling the RPC", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = grantNationResourcesMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        quantity: 0,
        resourceId: RESOURCE_ID,
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toSatisfy(isTreasuryMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("subsidizeConstructionProjectMutationOptions", () => {
  it("rejects a malformed project id before calling the RPC", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = subsidizeConstructionProjectMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        projectId: "not-a-uuid",
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toSatisfy(isTreasuryMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls the RPC with valid input", async () => {
    const rpc = vi.fn(() => ({ data: [], error: null }));
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = subsidizeConstructionProjectMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      nationId: NATION_ID,
      projectId: PROJECT_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    expect(rpc).toHaveBeenCalledWith("subsidize_construction_project", {
      p_nation_id: NATION_ID,
      p_project_id: PROJECT_ID,
    });
  });
});

describe("setNationTaxRateMutationOptions", () => {
  it("rejects a rate above the 50% cap before calling the RPC", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = setNationTaxRateMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        rate: 0.75,
        worldId: WORLD_ID,
      }),
    ).rejects.toSatisfy(isTreasuryMutationError);
    expect(rpc).not.toHaveBeenCalled();
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
