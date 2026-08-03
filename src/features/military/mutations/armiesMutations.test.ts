import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { armiesQueryKeys } from "../queries/armiesQueryKeys";

import {
  createArmyMutationOptions,
  deleteArmyMutationOptions,
  isArmyMutationError,
  moveArmyMutationOptions,
} from "./armiesMutations";

const ARMY_ID = "11111111-1111-1111-1111-111111111111";
const NATION_ID = "22222222-2222-2222-2222-222222222222";
const SETTLEMENT_ID = "33333333-3333-3333-3333-333333333333";

type ArmyRow = {
  readonly created_at: string;
  readonly created_turn_number: number;
  readonly funding_source: string;
  readonly id: string;
  readonly name: string;
  readonly nation_id: string;
  readonly stationed_settlement_id: string;
  readonly updated_at: string;
  readonly world_id: string;
};

function createArmyRow(overrides: Partial<ArmyRow> = {}): ArmyRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    created_turn_number: 1,
    funding_source: "nation",
    id: ARMY_ID,
    name: "1st Legion",
    nation_id: NATION_ID,
    stationed_settlement_id: SETTLEMENT_ID,
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: "44444444-4444-4444-4444-444444444444",
    ...overrides,
  };
}

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

describe("createArmyMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createArmyMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        fundingSource: "nation",
        name: "",
        nationId: NATION_ID,
        stationedSettlementId: SETTLEMENT_ID,
      }),
    ).rejects.toSatisfy(isArmyMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls create_army with trimmed name and snake_case args", async () => {
    const { client, calls } = createRpcClient({
      data: createArmyRow(),
      error: null,
    });
    const queryClient = createQueryClient();
    const options = createArmyMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      fundingSource: "host_settlement",
      name: "  1st Legion  ",
      nationId: NATION_ID,
      stationedSettlementId: SETTLEMENT_ID,
    });

    expect(result).toMatchObject({ id: ARMY_ID, name: "1st Legion" });
    expect(calls.rpc).toHaveBeenCalledWith("create_army", {
      p_funding_source: "host_settlement",
      p_name: "1st Legion",
      p_nation_id: NATION_ID,
      p_stationed_settlement_id: SETTLEMENT_ID,
    });
  });

  it("translates a 42501 error into a forbidden rejection", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "forbidden" },
    });
    const queryClient = createQueryClient();
    const options = createArmyMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        fundingSource: "nation",
        name: "1st Legion",
        nationId: NATION_ID,
        stationedSettlementId: SETTLEMENT_ID,
      }),
    ).rejects.toMatchObject({ code: "army_forbidden" });
  });

  it("translates the settlement_not_in_nation hint", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "22023",
        hint: "settlement_not_in_nation",
        message: "stationed settlement must belong to the nation",
      },
    });
    const queryClient = createQueryClient();
    const options = createArmyMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        fundingSource: "nation",
        name: "1st Legion",
        nationId: NATION_ID,
        stationedSettlementId: SETTLEMENT_ID,
      }),
    ).rejects.toMatchObject({ code: "settlement_not_in_nation" });
  });
});

describe("moveArmyMutationOptions", () => {
  it("calls move_army with the army and destination settlement", async () => {
    const { client, calls } = createRpcClient({
      data: createArmyRow({ stationed_settlement_id: SETTLEMENT_ID }),
      error: null,
    });
    const queryClient = createQueryClient();
    const options = moveArmyMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      armyId: ARMY_ID,
      settlementId: SETTLEMENT_ID,
    });

    expect(calls.rpc).toHaveBeenCalledWith("move_army", {
      p_army_id: ARMY_ID,
      p_settlement_id: SETTLEMENT_ID,
    });
  });

  it("invalidates all army queries, covering origin and destination garrisons", async () => {
    const { client } = createRpcClient({
      data: createArmyRow({ stationed_settlement_id: SETTLEMENT_ID }),
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = moveArmyMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      armyId: ARMY_ID,
      settlementId: SETTLEMENT_ID,
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: armiesQueryKeys.all }),
    );
  });
});

describe("deleteArmyMutationOptions", () => {
  it("maps the army_not_empty hint to a friendly guard message", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "22023",
        hint: "army_not_empty",
        message: "army still has groups or units",
      },
    });
    const queryClient = createQueryClient();
    const options = deleteArmyMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, { armyId: ARMY_ID }),
    ).rejects.toMatchObject({
      code: "army_not_empty",
      message: "Army must have no groups or units before it can be deleted.",
    });
  });

  it("resolves with the deleted army id", async () => {
    const { client } = createRpcClient({ data: undefined, error: null });
    const queryClient = createQueryClient();
    const options = deleteArmyMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      armyId: ARMY_ID,
    });

    expect(result).toEqual({ armyId: ARMY_ID });
  });

  it("invalidates all army queries after deletion", async () => {
    const { client } = createRpcClient({ data: undefined, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = deleteArmyMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, { armyId: ARMY_ID });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: armiesQueryKeys.all }),
    );
  });
});
