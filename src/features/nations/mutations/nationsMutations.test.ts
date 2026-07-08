import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createNationMutationOptions,
  deleteNationMutationOptions,
  isNationMutationError,
  NationMutationError,
  setNationCapitalAndFoundedTurnMutationOptions,
  setNationCultureReligionMutationOptions,
  setNationTradePolicyMutationOptions,
  updateNationDetailsMutationOptions,
} from "./nationsMutations";

const NATION_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const SETTLEMENT_ID = "33333333-3333-3333-3333-333333333333";

type NationRow = {
  readonly capital_settlement_id?: string | null;
  readonly created_at: string;
  readonly description: string | null;
  readonly founded_turn_number?: number | null;
  readonly government_type?: string;
  readonly id: string;
  readonly name: string;
  readonly primary_culture_id?: string | null;
  readonly state_religion_id?: string | null;
  readonly tax_rate?: number;
  readonly trade_policy?: string;
  readonly updated_at: string;
  readonly world_id: string;
};

type DeleteRow = { readonly id: string; readonly world_id: string };

describe("createNationMutationOptions", () => {
  it("rejects a blank name before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createNationMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        worldId: WORLD_ID,
      }),
    ).rejects.toSatisfy(isNationMutationError);
    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nation_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts with trimmed name and null description, returns the created nation", async () => {
    const row = createNationRow();
    const { client, calls } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createNationMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      description: "  desc  ",
      name: "  Aldoria  ",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: NATION_ID, name: row.name });
    expect(calls.from).toHaveBeenCalledWith("nations");
    expect(calls.insert).toHaveBeenCalledWith({
      description: "desc",
      name: "Aldoria",
      world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual(["nations", "create-nation"]);
  });

  it("coerces an omitted description to null", async () => {
    const row = createNationRow({ description: null });
    const { client, calls } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createNationMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      name: "Aldoria",
      worldId: WORLD_ID,
    });

    expect(calls.insert).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );
  });

  it("raises nation_not_found when insert returns no row", async () => {
    const { client } = createInsertClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = createNationMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Aldoria",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nation_not_found" });
  });

  it("normalizes Supabase errors", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createNationMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Aldoria",
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });

  it("sets the founded turn via RPC after insert when foundedTurnNumber is provided", async () => {
    const insertedRow = createNationRow();
    const rpcRow = createNationRow({ founded_turn_number: 3 });
    const { client, calls } = createInsertAndRpcClient({
      insertResult: { data: insertedRow, error: null },
      rpcResult: { data: rpcRow, error: null },
    });
    const queryClient = createQueryClient();
    const options = createNationMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      foundedTurnNumber: 3,
      name: "Aldoria",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ foundedTurnNumber: 3, id: NATION_ID });
    expect(calls.rpc).toHaveBeenCalledWith(
      "set_nation_capital_and_founded_turn",
      {
        p_capital_settlement_id: null,
        p_founded_turn_number: 3,
        p_nation_id: NATION_ID,
      },
    );
  });

  it("does not call the RPC when foundedTurnNumber is omitted", async () => {
    const row = createNationRow();
    const { client, calls } = createInsertAndRpcClient({
      insertResult: { data: row, error: null },
      rpcResult: { data: row, error: null },
    });
    const queryClient = createQueryClient();
    const options = createNationMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      name: "Aldoria",
      worldId: WORLD_ID,
    });

    expect(calls.rpc).not.toHaveBeenCalled();
  });
});

describe("updateNationDetailsMutationOptions", () => {
  it("rejects a blank name before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateNationDetailsMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        nationId: NATION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nation_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updates with trimmed name and description, scoped by id and world", async () => {
    const row = createNationRow();
    const { client, calls } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateNationDetailsMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      description: "  a note  ",
      name: "  Aldoria  ",
      nationId: NATION_ID,
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: NATION_ID });
    expect(calls.from).toHaveBeenCalledWith("nations");
    expect(calls.update).toHaveBeenCalledWith({
      description: "a note",
      name: "Aldoria",
    });
    expect(calls.eqId).toHaveBeenCalledWith("id", NATION_ID);
    expect(calls.eqWorld).toHaveBeenCalledWith("world_id", WORLD_ID);
    expect(options.mutationKey).toEqual(["nations", "update-nation-details"]);
  });

  it("coerces an empty description string to null", async () => {
    const row = createNationRow({ description: null });
    const { client, calls } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateNationDetailsMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      description: "   ",
      name: "Aldoria",
      nationId: NATION_ID,
      worldId: WORLD_ID,
    });

    expect(calls.update).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );
  });

  it("raises nation_not_found when update returns no row", async () => {
    const { client } = createUpdateClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = updateNationDetailsMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Aldoria",
        nationId: NATION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nation_not_found" });
  });

  it("normalizes Supabase errors", async () => {
    const { client } = createUpdateClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = updateNationDetailsMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Aldoria",
        nationId: NATION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("setNationCapitalAndFoundedTurnMutationOptions", () => {
  it("rejects an invalid capitalSettlementId before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = setNationCapitalAndFoundedTurnMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        capitalSettlementId: "not-a-uuid",
        foundedTurnNumber: null,
        nationId: NATION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nation_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls the RPC with the nation id, capital settlement id, and founded turn", async () => {
    const row = createNationRow({
      capital_settlement_id: SETTLEMENT_ID,
      founded_turn_number: 3,
    });
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = setNationCapitalAndFoundedTurnMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      capitalSettlementId: SETTLEMENT_ID,
      foundedTurnNumber: 3,
      nationId: NATION_ID,
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({
      capitalSettlementId: SETTLEMENT_ID,
      foundedTurnNumber: 3,
      id: NATION_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith(
      "set_nation_capital_and_founded_turn",
      {
        p_capital_settlement_id: SETTLEMENT_ID,
        p_founded_turn_number: 3,
        p_nation_id: NATION_ID,
      },
    );
    expect(options.mutationKey).toEqual([
      "nations",
      "set-nation-capital-and-founded-turn",
    ]);
  });

  it("clears the capital and founded turn when both are null", async () => {
    const row = createNationRow({
      capital_settlement_id: null,
      founded_turn_number: null,
    });
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = setNationCapitalAndFoundedTurnMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      capitalSettlementId: null,
      foundedTurnNumber: null,
      nationId: NATION_ID,
      worldId: WORLD_ID,
    });

    expect(calls.rpc).toHaveBeenCalledWith(
      "set_nation_capital_and_founded_turn",
      {
        p_capital_settlement_id: null,
        p_founded_turn_number: null,
        p_nation_id: NATION_ID,
      },
    );
  });

  it("raises nation_not_found when the RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = setNationCapitalAndFoundedTurnMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        capitalSettlementId: null,
        foundedTurnNumber: null,
        nationId: NATION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nation_not_found" });
  });

  it("normalizes Supabase errors, e.g. an out-of-nation capital settlement", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "23514",
        message: "Capital settlement must belong to this nation.",
      },
    });
    const queryClient = createQueryClient();
    const options = setNationCapitalAndFoundedTurnMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        capitalSettlementId: SETTLEMENT_ID,
        foundedTurnNumber: null,
        nationId: NATION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("setNationTradePolicyMutationOptions", () => {
  it("rejects an invalid tradePolicy before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = setNationTradePolicyMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        tradePolicy: "occupied",
      }),
    ).rejects.toMatchObject({ code: "nation_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls the RPC with the nation id and trade policy", async () => {
    const row = createNationRow({ trade_policy: "state_controlled" });
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = setNationTradePolicyMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      nationId: NATION_ID,
      tradePolicy: "state_controlled",
    });

    expect(result).toMatchObject({
      id: NATION_ID,
      tradePolicy: "state_controlled",
    });
    expect(calls.rpc).toHaveBeenCalledWith("set_nation_trade_policy", {
      p_nation_id: NATION_ID,
      p_trade_policy: "state_controlled",
    });
    expect(options.mutationKey).toEqual(["nations", "set-nation-trade-policy"]);
  });

  it("raises nation_not_found when the RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = setNationTradePolicyMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        tradePolicy: "closed",
      }),
    ).rejects.toMatchObject({ code: "nation_not_found" });
  });

  it("normalizes Supabase errors, e.g. an unauthorized manager", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "42501",
        message: "You do not have permission to manage this nation.",
      },
    });
    const queryClient = createQueryClient();
    const options = setNationTradePolicyMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        tradePolicy: "closed",
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("setNationCultureReligionMutationOptions", () => {
  it("rejects an invalid primaryCultureId before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = setNationCultureReligionMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        primaryCultureId: "not-a-uuid",
        stateReligionId: null,
      }),
    ).rejects.toMatchObject({ code: "nation_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls the RPC with the nation id, culture id, and religion id", async () => {
    const cultureId = "44444444-4444-4444-4444-444444444444";
    const religionId = "55555555-5555-5555-5555-555555555555";
    const row = createNationRow({
      primary_culture_id: cultureId,
      state_religion_id: religionId,
    });
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = setNationCultureReligionMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      nationId: NATION_ID,
      primaryCultureId: cultureId,
      stateReligionId: religionId,
    });

    expect(result).toMatchObject({
      id: NATION_ID,
      primaryCultureId: cultureId,
      stateReligionId: religionId,
    });
    expect(calls.rpc).toHaveBeenCalledWith("set_nation_culture_religion", {
      p_nation_id: NATION_ID,
      p_primary_culture_id: cultureId,
      p_state_religion_id: religionId,
    });
    expect(options.mutationKey).toEqual([
      "nations",
      "set-nation-culture-religion",
    ]);
  });

  it("accepts null culture and religion ids to clear both fields", async () => {
    const row = createNationRow({
      primary_culture_id: null,
      state_religion_id: null,
    });
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = setNationCultureReligionMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      nationId: NATION_ID,
      primaryCultureId: null,
      stateReligionId: null,
    });

    expect(calls.rpc).toHaveBeenCalledWith("set_nation_culture_religion", {
      p_nation_id: NATION_ID,
      p_primary_culture_id: null,
      p_state_religion_id: null,
    });
  });

  it("raises nation_not_found when the RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = setNationCultureReligionMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        primaryCultureId: null,
        stateReligionId: null,
      }),
    ).rejects.toMatchObject({ code: "nation_not_found" });
  });

  it("normalizes Supabase errors, e.g. an unauthorized manager", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "42501",
        message: "You do not have permission to manage this nation.",
      },
    });
    const queryClient = createQueryClient();
    const options = setNationCultureReligionMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        primaryCultureId: null,
        stateReligionId: null,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("deleteNationMutationOptions", () => {
  it("rejects an invalid nationId before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = deleteNationMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        nationId: "not-a-uuid",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nation_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("deletes the nation scoped by id and world, returns nationId and worldId", async () => {
    const deleteRow: DeleteRow = { id: NATION_ID, world_id: WORLD_ID };
    const { client, calls } = createDeleteClient({
      data: deleteRow,
      error: null,
    });
    const queryClient = createQueryClient();
    const options = deleteNationMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      nationId: NATION_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ nationId: NATION_ID, worldId: WORLD_ID });
    expect(calls.from).toHaveBeenCalledWith("nations");
    expect(calls.eqId).toHaveBeenCalledWith("id", NATION_ID);
    expect(calls.eqWorld).toHaveBeenCalledWith("world_id", WORLD_ID);
    expect(options.mutationKey).toEqual(["nations", "delete-nation"]);
  });

  it("raises nation_not_found when delete returns no row", async () => {
    const { client } = createDeleteClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = deleteNationMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nation_not_found" });
  });

  it("normalizes Supabase errors", async () => {
    const { client } = createDeleteClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = deleteNationMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("NationMutationError / isNationMutationError", () => {
  it("identifies NationMutationError instances", () => {
    const err = new NationMutationError({
      code: "nation_not_found",
      message: "not found",
    });
    expect(isNationMutationError(err)).toBe(true);
    expect(isNationMutationError(new Error("other"))).toBe(false);
  });
});

function createNationRow(overrides: Partial<NationRow> = {}): NationRow {
  return {
    created_at: "2026-05-01T00:00:00.000Z",
    description: null,
    government_type: "monarchy",
    id: NATION_ID,
    name: "Aldoria",
    tax_rate: 0,
    updated_at: "2026-05-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createInsertClient(result: SupabaseResult<NationRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly from: ReturnType<typeof vi.fn>;
    readonly insert: ReturnType<typeof vi.fn>;
  };
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    calls: { from, insert },
  };
}

function createInsertAndRpcClient({
  insertResult,
  rpcResult,
}: {
  readonly insertResult: SupabaseResult<NationRow>;
  readonly rpcResult: SupabaseResult<NationRow>;
}): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly from: ReturnType<typeof vi.fn>;
    readonly insert: ReturnType<typeof vi.fn>;
    readonly rpc: ReturnType<typeof vi.fn>;
  };
} {
  const insertMaybeSingle = vi.fn().mockResolvedValue(insertResult);
  const select = vi.fn(() => ({ maybeSingle: insertMaybeSingle }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  const rpcMaybeSingle = vi.fn().mockResolvedValue(rpcResult);
  const rpc = vi.fn(() => ({ maybeSingle: rpcMaybeSingle }));
  return {
    client: { from, rpc } as unknown as GubernatorSupabaseClient,
    calls: { from, insert, rpc },
  };
}

function createUpdateClient(result: SupabaseResult<NationRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly from: ReturnType<typeof vi.fn>;
    readonly update: ReturnType<typeof vi.fn>;
    readonly eqId: ReturnType<typeof vi.fn>;
    readonly eqWorld: ReturnType<typeof vi.fn>;
  };
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eqWorld = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqWorld }));
  const update = vi.fn(() => ({ eq: eqId }));
  const from = vi.fn(() => ({ update }));
  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    calls: { from, update, eqId, eqWorld },
  };
}

function createRpcClient(result: SupabaseResult<NationRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly rpc: ReturnType<typeof vi.fn>;
  };
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ maybeSingle }));
  return {
    client: { rpc } as unknown as GubernatorSupabaseClient,
    calls: { rpc },
  };
}

function createDeleteClient(result: SupabaseResult<DeleteRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly from: ReturnType<typeof vi.fn>;
    readonly eqId: ReturnType<typeof vi.fn>;
    readonly eqWorld: ReturnType<typeof vi.fn>;
  };
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eqWorld = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqWorld }));
  const del = vi.fn(() => ({ eq: eqId }));
  const from = vi.fn(() => ({ delete: del }));
  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    calls: { from, eqId, eqWorld },
  };
}

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
