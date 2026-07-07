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
  setNationHiddenMutationOptions,
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
  readonly id: string;
  readonly is_hidden: boolean;
  readonly name: string;
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
      isHidden: false,
      name: "  Aldoria  ",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: NATION_ID, name: row.name });
    expect(calls.from).toHaveBeenCalledWith("nations");
    expect(calls.insert).toHaveBeenCalledWith({
      description: "desc",
      is_hidden: false,
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

describe("setNationHiddenMutationOptions", () => {
  it("rejects missing isHidden before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = setNationHiddenMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        isHidden: "yes",
        nationId: NATION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nation_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updates is_hidden, scoped by id and world", async () => {
    const row = createNationRow({ is_hidden: true });
    const { client, calls } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = setNationHiddenMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      isHidden: true,
      nationId: NATION_ID,
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: NATION_ID, isHidden: true });
    expect(calls.from).toHaveBeenCalledWith("nations");
    expect(calls.update).toHaveBeenCalledWith({ is_hidden: true });
    expect(calls.eqId).toHaveBeenCalledWith("id", NATION_ID);
    expect(calls.eqWorld).toHaveBeenCalledWith("world_id", WORLD_ID);
    expect(options.mutationKey).toEqual(["nations", "set-nation-hidden"]);
  });

  it("raises nation_not_found when update returns no row", async () => {
    const { client } = createUpdateClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = setNationHiddenMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        isHidden: false,
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
    const options = setNationHiddenMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        isHidden: false,
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
    id: NATION_ID,
    is_hidden: false,
    name: "Aldoria",
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
