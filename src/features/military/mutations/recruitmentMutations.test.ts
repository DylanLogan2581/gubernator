import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  dischargeSoldiersMutationOptions,
  isRecruitmentMutationError,
  recruitSoldiersMutationOptions,
} from "./recruitmentMutations";

const UNIT_ID = "11111111-1111-1111-1111-111111111111";
const SETTLEMENT_ID = "22222222-2222-2222-2222-222222222222";
const CITIZEN_ID = "33333333-3333-3333-3333-333333333333";
const SOLDIER_ID = "44444444-4444-4444-4444-444444444444";

type SupabaseError = {
  readonly code?: string;
  readonly hint?: string;
  readonly message: string;
};
type SupabaseResult<T> =
  | { readonly data: T; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError };

function createRpcClient<T>(result: SupabaseResult<T>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: { readonly rpc: ReturnType<typeof vi.fn> };
} {
  const rpc = vi.fn().mockResolvedValue(result);
  return {
    client: { rpc } as unknown as GubernatorSupabaseClient,
    calls: { rpc },
  };
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

describe("recruitSoldiersMutationOptions", () => {
  it("rejects an empty citizen selection before touching the client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = recruitSoldiersMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenIds: [],
        settlementId: SETTLEMENT_ID,
        unitId: UNIT_ID,
      }),
    ).rejects.toSatisfy(isRecruitmentMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls recruit_soldiers with snake_case args", async () => {
    const { client, calls } = createRpcClient({
      data: [
        {
          citizen_id: CITIZEN_ID,
          created_at: "2026-01-01T00:00:00.000Z",
          home_settlement_id: SETTLEMENT_ID,
          id: SOLDIER_ID,
          recruited_turn_number: 3,
          unit_id: UNIT_ID,
          world_id: "55555555-5555-5555-5555-555555555555",
        },
      ],
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = recruitSoldiersMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      citizenIds: [CITIZEN_ID],
      settlementId: SETTLEMENT_ID,
      unitId: UNIT_ID,
    });

    expect(result).toEqual([
      expect.objectContaining({ citizenId: CITIZEN_ID, id: SOLDIER_ID }),
    ]);
    expect(calls.rpc).toHaveBeenCalledWith("recruit_soldiers", {
      p_citizen_ids: [CITIZEN_ID],
      p_settlement_id: SETTLEMENT_ID,
      p_unit_id: UNIT_ID,
    });
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("maps the unit_capacity_exceeded hint to a friendly message", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "22023",
        hint: "unit_capacity_exceeded",
        message: "unit capacity exceeded: 5 current + 2 new > 6 max",
      },
    });
    const queryClient = createQueryClient();
    const options = recruitSoldiersMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenIds: [CITIZEN_ID],
        settlementId: SETTLEMENT_ID,
        unitId: UNIT_ID,
      }),
    ).rejects.toMatchObject({ code: "recruitment_unit_capacity_exceeded" });
  });

  it("falls back to the RPC's message for an unrecognized rejection (e.g. cost shortfall)", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "22023", message: "insufficient iron: need 10, have 4" },
    });
    const queryClient = createQueryClient();
    const options = recruitSoldiersMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenIds: [CITIZEN_ID],
        settlementId: SETTLEMENT_ID,
        unitId: UNIT_ID,
      }),
    ).rejects.toMatchObject({
      code: "recruitment_rejected",
      message: "insufficient iron: need 10, have 4",
    });
  });
});

describe("dischargeSoldiersMutationOptions", () => {
  it("calls discharge_soldiers and returns the now-civilian citizen ids", async () => {
    const { client, calls } = createRpcClient({
      data: [{ id: CITIZEN_ID }],
      error: null,
    });
    const queryClient = createQueryClient();
    const options = dischargeSoldiersMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
      unitId: UNIT_ID,
    });

    const result = await executeMutation(queryClient, options, {
      soldierIds: [SOLDIER_ID],
    });

    expect(result).toEqual({ citizenIds: [CITIZEN_ID] });
    expect(calls.rpc).toHaveBeenCalledWith("discharge_soldiers", {
      p_soldier_ids: [SOLDIER_ID],
    });
  });

  it("translates a 42501 error into a forbidden rejection", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "forbidden" },
    });
    const queryClient = createQueryClient();
    const options = dischargeSoldiersMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
      unitId: UNIT_ID,
    });

    await expect(
      executeMutation(queryClient, options, { soldierIds: [SOLDIER_ID] }),
    ).rejects.toMatchObject({ code: "recruitment_forbidden" });
  });
});
