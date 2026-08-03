import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  dismissNationOfficeMutationOptions,
  dismissSettlementOfficeMutationOptions,
  renewNationOfficeMutationOptions,
  renewSettlementOfficeMutationOptions,
} from "./officesMutations";

const NATION_ID = "11111111-1111-1111-1111-111111111111";
const SETTLEMENT_ID = "22222222-2222-2222-2222-222222222222";
const OFFICE_ID = "33333333-3333-3333-3333-333333333333";
const WORLD_ID = "44444444-4444-4444-4444-444444444444";

function createRpcClient(): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  return { client: { rpc } as unknown as GubernatorSupabaseClient, rpc };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
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

describe("dismissNationOfficeMutationOptions", () => {
  it("invalidates the nation office roster and history caches", async () => {
    const { client } = createRpcClient();
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = dismissNationOfficeMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      nationId: NATION_ID,
      officeId: OFFICE_ID,
      worldId: WORLD_ID,
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["nations", "offices", "roster", NATION_ID],
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["nations", "offices", "history", NATION_ID],
      }),
    );
  });
});

describe("renewNationOfficeMutationOptions", () => {
  it("invalidates the nation office roster and history caches", async () => {
    const { client } = createRpcClient();
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = renewNationOfficeMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      nationId: NATION_ID,
      officeId: OFFICE_ID,
      worldId: WORLD_ID,
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["nations", "offices", "roster", NATION_ID],
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["nations", "offices", "history", NATION_ID],
      }),
    );
  });
});

describe("dismissSettlementOfficeMutationOptions", () => {
  it("invalidates the settlement office roster and history caches", async () => {
    const { client } = createRpcClient();
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = dismissSettlementOfficeMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      officeId: OFFICE_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["nations", "offices", "settlement-roster", SETTLEMENT_ID],
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["nations", "offices", "settlement-history", SETTLEMENT_ID],
      }),
    );
  });
});

describe("renewSettlementOfficeMutationOptions", () => {
  it("invalidates the settlement office roster and history caches", async () => {
    const { client } = createRpcClient();
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = renewSettlementOfficeMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      officeId: OFFICE_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["nations", "offices", "settlement-roster", SETTLEMENT_ID],
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["nations", "offices", "settlement-history", SETTLEMENT_ID],
      }),
    );
  });
});
