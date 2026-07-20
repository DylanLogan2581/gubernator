import { QueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";
import type { WorldNamingConfig } from "@/lib/worldNamingConfigSchemas";

import {
  createNamesetMutationOptions,
  hardDeleteNamesetMutationOptions,
  isNamesetMutationError,
  restoreNamesetMutationOptions,
  setDefaultNamesetMutationOptions,
  setNationNamesetMutationOptions,
  setSettlementNamesetMutationOptions,
  softDeleteNamesetMutationOptions,
  updateNamesetMutationOptions,
} from "./namesetsMutations";

const WORLD_ID = "11111111-1111-1111-1111-111111111111";
const NAMESET_ID = "22222222-2222-2222-2222-222222222222";
const NATION_ID = "33333333-3333-3333-3333-333333333333";
const SETTLEMENT_ID = "44444444-4444-4444-4444-444444444444";

const validConfig: WorldNamingConfig = {
  type: "list",
  convention: "pool",
  female_given_names: ["Aria"],
  male_given_names: ["Bram"],
  surnames: ["Voss"],
};

type SupabaseError = { readonly code?: string; readonly message: string };

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function executeMutation<TData, TVariables>(
  queryClient: QueryClient,
  options: UseMutationOptions<TData, Error, TVariables>,
  variables: TVariables,
): Promise<TData> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}

const namesetRow = {
  id: NAMESET_ID,
  world_id: WORLD_ID,
  name: "Coastal Names",
  config_json: validConfig,
  is_default: false,
  is_trashed: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("createNamesetMutationOptions", () => {
  function createClient(
    result: { data: unknown; error: SupabaseError | null } = {
      data: namesetRow,
      error: null,
    },
  ): {
    readonly client: GubernatorSupabaseClient;
    readonly from: ReturnType<typeof vi.fn>;
    readonly insert: ReturnType<typeof vi.fn>;
  } {
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const select = vi.fn(() => ({ maybeSingle }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    return {
      client: { from } as unknown as GubernatorSupabaseClient,
      from,
      insert,
    };
  }

  it("creates a nameset and invalidates by-world and active-by-world queries", async () => {
    const { client, from, insert } = createClient();
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = createNamesetMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      worldId: WORLD_ID,
      name: "Coastal Names",
      configJson: validConfig,
    });

    expect(result).toMatchObject({ id: NAMESET_ID, worldId: WORLD_ID });
    expect(from).toHaveBeenCalledWith("namesets");
    expect(insert).toHaveBeenCalledWith({
      world_id: WORLD_ID,
      name: "Coastal Names",
      config_json: validConfig,
    });
    expect(options.mutationKey).toEqual(["namesets", "create-nameset"]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "by-world", WORLD_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "active-by-world", WORLD_ID],
    });
  });

  it("rejects a blank name before touching the DB", async () => {
    const { client, from } = createClient();
    const queryClient = createQueryClient();
    const options = createNamesetMutationOptions({ client, queryClient });

    const result = executeMutation(queryClient, options, {
      worldId: WORLD_ID,
      name: "",
      configJson: validConfig,
    });

    await expect(result).rejects.toSatisfy(isNamesetMutationError);
    await expect(result).rejects.toMatchObject({
      code: "nameset_input_invalid",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns not-found when the insert returns null", async () => {
    const { client } = createClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = createNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        worldId: WORLD_ID,
        name: "Coastal Names",
        configJson: validConfig,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_found" });
  });

  it("normalizes Supabase errors from the insert", async () => {
    const { client } = createClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        worldId: WORLD_ID,
        name: "Coastal Names",
        configJson: validConfig,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("updateNamesetMutationOptions", () => {
  function createClient(
    result: { data: unknown; error: SupabaseError | null } = {
      data: namesetRow,
      error: null,
    },
  ): {
    readonly client: GubernatorSupabaseClient;
    readonly from: ReturnType<typeof vi.fn>;
    readonly update: ReturnType<typeof vi.fn>;
    readonly eqId: ReturnType<typeof vi.fn>;
    readonly eqWorldId: ReturnType<typeof vi.fn>;
  } {
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const select = vi.fn(() => ({ maybeSingle }));
    const eqWorldId = vi.fn(() => ({ select }));
    const eqId = vi.fn(() => ({ eq: eqWorldId }));
    const update = vi.fn(() => ({ eq: eqId }));
    const from = vi.fn(() => ({ update }));
    return {
      client: { from } as unknown as GubernatorSupabaseClient,
      from,
      update,
      eqId,
      eqWorldId,
    };
  }

  it("updates a nameset and invalidates by-world and active-by-world queries", async () => {
    const { client, from, update, eqId, eqWorldId } = createClient();
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = updateNamesetMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      namesetId: NAMESET_ID,
      worldId: WORLD_ID,
      name: "Renamed",
      configJson: validConfig,
    });

    expect(result).toMatchObject({ id: NAMESET_ID });
    expect(from).toHaveBeenCalledWith("namesets");
    expect(update).toHaveBeenCalledWith({
      name: "Renamed",
      config_json: validConfig,
    });
    expect(eqId).toHaveBeenCalledWith("id", NAMESET_ID);
    expect(eqWorldId).toHaveBeenCalledWith("world_id", WORLD_ID);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "by-world", WORLD_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "active-by-world", WORLD_ID],
    });
  });

  it("rejects invalid input before touching the DB", async () => {
    const { client, from } = createClient();
    const queryClient = createQueryClient();
    const options = updateNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        namesetId: "not-a-uuid",
        worldId: WORLD_ID,
        name: "Renamed",
        configJson: validConfig,
      }),
    ).rejects.toMatchObject({ code: "nameset_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns not-found when the update returns null", async () => {
    const { client } = createClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = updateNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        namesetId: NAMESET_ID,
        worldId: WORLD_ID,
        name: "Renamed",
        configJson: validConfig,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_found" });
  });

  it("normalizes Supabase errors from the update", async () => {
    const { client } = createClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = updateNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        namesetId: NAMESET_ID,
        worldId: WORLD_ID,
        name: "Renamed",
        configJson: validConfig,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

type RpcResultRow = { readonly id: string; readonly world_id: string };

function createRpcClient(result: {
  data: RpcResultRow | null;
  error: SupabaseError | null;
}): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ maybeSingle }));
  return { client: { rpc } as unknown as GubernatorSupabaseClient, rpc };
}

describe("softDeleteNamesetMutationOptions", () => {
  it("soft-deletes a nameset and invalidates by-world and active-by-world queries", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: NAMESET_ID, world_id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = softDeleteNamesetMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      namesetId: NAMESET_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ namesetId: NAMESET_ID, worldId: WORLD_ID });
    expect(rpc).toHaveBeenCalledWith("soft_delete_nameset", {
      p_nameset_id: NAMESET_ID,
      p_world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual(["namesets", "soft-delete-nameset"]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "by-world", WORLD_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "active-by-world", WORLD_ID],
    });
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = softDeleteNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        namesetId: NAMESET_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_authorized" });
  });

  it("returns not-found when the RPC returns null", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = softDeleteNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        namesetId: NAMESET_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_found" });
  });

  it("normalizes other Supabase errors", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "23505", message: "conflict" },
    });
    const queryClient = createQueryClient();
    const options = softDeleteNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        namesetId: NAMESET_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("restoreNamesetMutationOptions", () => {
  it("restores a nameset and invalidates by-world and active-by-world queries", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: NAMESET_ID, world_id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = restoreNamesetMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      namesetId: NAMESET_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ namesetId: NAMESET_ID, worldId: WORLD_ID });
    expect(rpc).toHaveBeenCalledWith("restore_nameset", {
      p_nameset_id: NAMESET_ID,
      p_world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual(["namesets", "restore-nameset"]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "by-world", WORLD_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "active-by-world", WORLD_ID],
    });
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = restoreNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        namesetId: NAMESET_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_authorized" });
  });

  it("returns not-found when the RPC returns null", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = restoreNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        namesetId: NAMESET_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_found" });
  });
});

describe("hardDeleteNamesetMutationOptions", () => {
  it("hard-deletes a nameset and invalidates by-world and active-by-world queries", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: NAMESET_ID, world_id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = hardDeleteNamesetMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      namesetId: NAMESET_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ namesetId: NAMESET_ID, worldId: WORLD_ID });
    expect(rpc).toHaveBeenCalledWith("hard_delete_nameset", {
      p_nameset_id: NAMESET_ID,
      p_world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual(["namesets", "hard-delete-nameset"]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "by-world", WORLD_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "active-by-world", WORLD_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settlements"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["citizens"],
    });
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = hardDeleteNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        namesetId: NAMESET_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_authorized" });
  });

  it("returns not-found when the RPC returns null", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = hardDeleteNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        namesetId: NAMESET_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_found" });
  });
});

describe("setDefaultNamesetMutationOptions", () => {
  it("sets the default nameset and invalidates by-world and active-by-world queries", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: NAMESET_ID, world_id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = setDefaultNamesetMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      namesetId: NAMESET_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ namesetId: NAMESET_ID, worldId: WORLD_ID });
    expect(rpc).toHaveBeenCalledWith("set_world_default_nameset", {
      p_nameset_id: NAMESET_ID,
      p_world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual(["namesets", "set-default-nameset"]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "by-world", WORLD_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "active-by-world", WORLD_ID],
    });
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = setDefaultNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        namesetId: NAMESET_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_authorized" });
  });

  it("returns not-found when the RPC returns null", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = setDefaultNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        namesetId: NAMESET_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_found" });
  });
});

type EntityRpcResultRow = {
  readonly id: string;
  readonly world_id: string;
  readonly nameset_id: string | null;
};

function createEntityRpcClient(result: {
  data: EntityRpcResultRow | null;
  error: SupabaseError | null;
}): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ maybeSingle }));
  return { client: { rpc } as unknown as GubernatorSupabaseClient, rpc };
}

describe("setNationNamesetMutationOptions", () => {
  it("sets the nation nameset and invalidates active-by-world, nation detail, and nation list", async () => {
    const { client, rpc } = createEntityRpcClient({
      data: { id: NATION_ID, world_id: WORLD_ID, nameset_id: NAMESET_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = setNationNamesetMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      nationId: NATION_ID,
      worldId: WORLD_ID,
      namesetId: NAMESET_ID,
    });

    expect(result).toEqual({
      entityId: NATION_ID,
      worldId: WORLD_ID,
      namesetId: NAMESET_ID,
    });
    expect(rpc).toHaveBeenCalledWith("set_nation_nameset", {
      p_nation_id: NATION_ID,
      p_world_id: WORLD_ID,
      p_nameset_id: NAMESET_ID,
    });
    expect(options.mutationKey).toEqual(["namesets", "set-nation-nameset"]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "active-by-world", WORLD_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "detail", NATION_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "list", WORLD_ID],
    });
  });

  it("passes undefined to clear the override when namesetId is null", async () => {
    const { client, rpc } = createEntityRpcClient({
      data: { id: NATION_ID, world_id: WORLD_ID, nameset_id: null },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = setNationNamesetMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      nationId: NATION_ID,
      worldId: WORLD_ID,
      namesetId: null,
    });

    expect(rpc).toHaveBeenCalledWith("set_nation_nameset", {
      p_nation_id: NATION_ID,
      p_world_id: WORLD_ID,
      p_nameset_id: undefined,
    });
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createEntityRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = setNationNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        worldId: WORLD_ID,
        namesetId: NAMESET_ID,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_authorized" });
  });

  it("returns not-found when the RPC returns null", async () => {
    const { client } = createEntityRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = setNationNamesetMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        worldId: WORLD_ID,
        namesetId: NAMESET_ID,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_found" });
  });
});

describe("setSettlementNamesetMutationOptions", () => {
  it("sets the settlement nameset and invalidates active-by-world, settlement detail, and settlement list", async () => {
    const { client, rpc } = createEntityRpcClient({
      data: { id: SETTLEMENT_ID, world_id: WORLD_ID, nameset_id: NAMESET_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = setSettlementNamesetMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
      namesetId: NAMESET_ID,
    });

    expect(result).toEqual({
      entityId: SETTLEMENT_ID,
      worldId: WORLD_ID,
      namesetId: NAMESET_ID,
    });
    expect(rpc).toHaveBeenCalledWith("set_settlement_nameset", {
      p_settlement_id: SETTLEMENT_ID,
      p_world_id: WORLD_ID,
      p_nameset_id: NAMESET_ID,
    });
    expect(options.mutationKey).toEqual(["namesets", "set-settlement-nameset"]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["namesets", "active-by-world", WORLD_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settlements", "detail", SETTLEMENT_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settlements", "by-world", WORLD_ID],
    });
  });

  it("passes undefined to clear the override when namesetId is null", async () => {
    const { client, rpc } = createEntityRpcClient({
      data: { id: SETTLEMENT_ID, world_id: WORLD_ID, nameset_id: null },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = setSettlementNamesetMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
      namesetId: null,
    });

    expect(rpc).toHaveBeenCalledWith("set_settlement_nameset", {
      p_settlement_id: SETTLEMENT_ID,
      p_world_id: WORLD_ID,
      p_nameset_id: undefined,
    });
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createEntityRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = setSettlementNamesetMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
        namesetId: NAMESET_ID,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_authorized" });
  });

  it("returns not-found when the RPC returns null", async () => {
    const { client } = createEntityRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = setSettlementNamesetMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
        namesetId: NAMESET_ID,
      }),
    ).rejects.toMatchObject({ code: "nameset_not_found" });
  });
});
