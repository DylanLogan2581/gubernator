import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createSettlementMutationOptions,
  deleteSettlementMutationOptions,
  isSettlementMutationError,
  updateSettlementCoordinatesMutationOptions,
  updateSettlementDetailsMutationOptions,
} from "./settlementsMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const NATION_ID = "22222222-2222-2222-2222-222222222222";
const WORLD_ID = "33333333-3333-3333-3333-333333333333";

type SettlementRow = {
  readonly coord_x: number | null;
  readonly coord_z: number | null;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly nation_id: string;
  readonly updated_at: string;
};

function createSettlementRow(
  overrides: Partial<SettlementRow> = {},
): SettlementRow {
  return {
    coord_x: null,
    coord_z: null,
    created_at: "2026-05-01T00:00:00.000Z",
    description: null,
    id: SETTLEMENT_ID,
    name: "Ironhold",
    nation_id: NATION_ID,
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createInsertClient(result: SupabaseResult<SettlementRow>): {
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

function createUpdateClient(result: SupabaseResult<SettlementRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly from: ReturnType<typeof vi.fn>;
    readonly update: ReturnType<typeof vi.fn>;
    readonly eqId: ReturnType<typeof vi.fn>;
    readonly eqNationId: ReturnType<typeof vi.fn>;
  };
} {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const eqNationId = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqNationId }));
  const update = vi.fn(() => ({ eq: eqId }));
  const from = vi.fn(() => ({ update }));
  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    calls: { from, update, eqId, eqNationId },
  };
}

function createDeleteClient(
  result: SupabaseResult<{ readonly id: string; readonly nation_id: string }>,
): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly from: ReturnType<typeof vi.fn>;
    readonly eqId: ReturnType<typeof vi.fn>;
    readonly eqNationId: ReturnType<typeof vi.fn>;
  };
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eqNationId = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqNationId }));
  const deleteFn = vi.fn(() => ({ eq: eqId }));
  const from = vi.fn(() => ({ delete: deleteFn }));
  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    calls: { from, eqId, eqNationId },
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

describe("createSettlementMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createSettlementMutationOptions({ client, queryClient });

    const result = executeMutation(queryClient, options, {
      name: "   ",
      nationId: NATION_ID,
      worldId: WORLD_ID,
    });

    await expect(result).rejects.toSatisfy(isSettlementMutationError);
    await expect(result).rejects.toMatchObject({
      code: "settlement_input_invalid",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts the settlement with trimmed inputs on success", async () => {
    const settlementRow = createSettlementRow({
      coord_x: 100,
      coord_z: -200,
      description: "A fortress.",
    });
    const { client, calls } = createInsertClient({
      data: settlementRow,
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = createSettlementMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      coordX: 100,
      coordZ: -200,
      description: "  A fortress.  ",
      name: "  Ironhold  ",
      nationId: NATION_ID,
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: SETTLEMENT_ID, name: "Ironhold" });
    expect(calls.from).toHaveBeenCalledWith("settlements");
    expect(calls.insert).toHaveBeenCalledWith({
      coord_x: 100,
      coord_z: -200,
      description: "A fortress.",
      name: "Ironhold",
      nation_id: NATION_ID,
    });
    expect(options.mutationKey).toEqual(["settlements", "create-settlement"]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "settlements", NATION_ID],
    });
  });

  it("raises a not-found error when the insert returns null", async () => {
    const { client } = createInsertClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = createSettlementMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Ironhold",
        nationId: NATION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "settlement_not_found" });
  });

  it("normalizes Supabase errors", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createSettlementMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Ironhold",
        nationId: NATION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("updateSettlementDetailsMutationOptions", () => {
  it("rejects a blank settlement name before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateSettlementDetailsMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "settlement_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updates name and description scoped by id and nation, and invalidates caches", async () => {
    const settlementRow = createSettlementRow({ description: "A great city." });
    const { client, calls } = createUpdateClient({
      data: settlementRow,
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = updateSettlementDetailsMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      description: "  A great city.  ",
      name: "  Ironhold  ",
      nationId: NATION_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    expect(calls.from).toHaveBeenCalledWith("settlements");
    expect(calls.update).toHaveBeenCalledWith({
      description: "A great city.",
      name: "Ironhold",
    });
    expect(calls.eqId).toHaveBeenCalledWith("id", SETTLEMENT_ID);
    expect(calls.eqNationId).toHaveBeenCalledWith("nation_id", NATION_ID);
    expect(options.mutationKey).toEqual([
      "settlements",
      "update-settlement-details",
    ]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settlements", "detail", SETTLEMENT_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "settlements", NATION_ID],
    });
  });

  it("raises a not-found error when the update returns null", async () => {
    const { client } = createUpdateClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = updateSettlementDetailsMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "Ironhold",
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "settlement_not_found" });
  });

  it("normalizes Supabase errors", async () => {
    const { client } = createUpdateClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = updateSettlementDetailsMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "Ironhold",
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("updateSettlementCoordinatesMutationOptions", () => {
  it("rejects Infinity for coordX before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateSettlementCoordinatesMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        coordX: Infinity,
        coordZ: 0,
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "settlement_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects NaN for coordZ before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateSettlementCoordinatesMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        coordX: 0,
        coordZ: NaN,
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "settlement_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updates coordinates scoped by id and nation", async () => {
    const settlementRow = createSettlementRow({ coord_x: 42, coord_z: -7 });
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({
        data: { id: SETTLEMENT_ID, coord_x: 42, coord_z: -7 },
        error: null,
      });
    const rpc = vi.fn(() => ({ maybeSingle }));

    const single = vi
      .fn()
      .mockResolvedValue({ data: settlementRow, error: null });
    const eqNationId = vi.fn(() => ({ single }));
    const eqId = vi.fn(() => ({ eq: eqNationId }));
    const selectFn = vi.fn(() => ({ eq: eqId }));
    const from = vi.fn(() => ({ select: selectFn }));

    const client = { rpc, from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = updateSettlementCoordinatesMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      coordX: 42,
      coordZ: -7,
      nationId: NATION_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    expect(rpc).toHaveBeenCalledWith("update_settlement_coordinates", {
      p_settlement_id: SETTLEMENT_ID,
      p_coord_x: 42,
      p_coord_z: -7,
    });
    expect(from).toHaveBeenCalledWith("settlements");
    expect(selectFn).toHaveBeenCalled();
    expect(eqId).toHaveBeenCalledWith("id", SETTLEMENT_ID);
    expect(eqNationId).toHaveBeenCalledWith("nation_id", NATION_ID);
    expect(options.mutationKey).toEqual([
      "settlements",
      "update-settlement-coordinates",
    ]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settlements", "detail", SETTLEMENT_ID],
    });
  });

  it("raises a not-found error when the update returns null", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const rpc = vi.fn(() => ({ maybeSingle }));
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateSettlementCoordinatesMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        coordX: 0,
        coordZ: 0,
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "settlement_not_found" });
  });

  it("normalizes Supabase errors", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const rpc = vi.fn(() => ({ maybeSingle }));
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateSettlementCoordinatesMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        coordX: 0,
        coordZ: 0,
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("deleteSettlementMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = deleteSettlementMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        nationId: "not-a-uuid",
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "settlement_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("deletes the settlement scoped by id and nation, and invalidates caches", async () => {
    const { client, calls } = createDeleteClient({
      data: { id: SETTLEMENT_ID, nation_id: NATION_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const removeQueries = vi.spyOn(queryClient, "removeQueries");
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = deleteSettlementMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      nationId: NATION_ID,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({
      nationId: NATION_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(calls.from).toHaveBeenCalledWith("settlements");
    expect(calls.eqId).toHaveBeenCalledWith("id", SETTLEMENT_ID);
    expect(calls.eqNationId).toHaveBeenCalledWith("nation_id", NATION_ID);
    expect(options.mutationKey).toEqual(["settlements", "delete-settlement"]);
    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: ["settlements", "detail", SETTLEMENT_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "settlements", NATION_ID],
    });
  });

  it("raises a not-found error when the delete returns null", async () => {
    const { client } = createDeleteClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = deleteSettlementMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "settlement_not_found" });
  });

  it("normalizes Supabase errors", async () => {
    const { client } = createDeleteClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = deleteSettlementMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        nationId: NATION_ID,
        settlementId: SETTLEMENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});
