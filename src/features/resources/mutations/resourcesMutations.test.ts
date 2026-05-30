import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";
import type { Json } from "@/types/database";

import {
  createResourceMutationOptions,
  isResourceMutationError,
  ResourceMutationError,
  softDeleteResourceMutationOptions,
  updateResourceMutationOptions,
} from "./resourcesMutations";

const RESOURCE_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";

type ResourceRow = {
  readonly base_stockpile_cap: number;
  readonly created_at: string;
  readonly id: string;
  readonly is_deleted: boolean;
  readonly is_system_resource: boolean;
  readonly last_cleanup_summary_json: Json;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

type DeleteRow = {
  readonly id: string;
  readonly last_cleanup_summary_json: Json;
  readonly world_id: string;
};

describe("createResourceMutationOptions", () => {
  it("rejects a blank name before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createResourceMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        slug: "iron-ore",
        worldId: WORLD_ID,
      }),
    ).rejects.toSatisfy(isResourceMutationError);
    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        slug: "iron-ore",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "resource_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an invalid baseStockpileCap before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createResourceMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        baseStockpileCap: "not-a-number",
        name: "Iron Ore",
        slug: "iron-ore",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "resource_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts with trimmed name and slug, returns the created resource", async () => {
    const row = createResourceRow();
    const { client, calls } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createResourceMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      baseStockpileCap: "100.5000",
      name: "  Iron Ore  ",
      slug: "  iron-ore  ",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: RESOURCE_ID, name: row.name });
    expect(calls.from).toHaveBeenCalledWith("resources");
    expect(calls.insert).toHaveBeenCalledWith({
      base_stockpile_cap: 100.5,
      name: "Iron Ore",
      slug: "iron-ore",
      world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual(["resources", "create-resource"]);
  });

  it("defaults baseStockpileCap to 0 when omitted", async () => {
    const row = createResourceRow({ base_stockpile_cap: 0 });
    const { client, calls } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createResourceMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      name: "Iron Ore",
      slug: "iron-ore",
      worldId: WORLD_ID,
    });

    expect(calls.insert).toHaveBeenCalledWith(
      expect.objectContaining({ base_stockpile_cap: 0 }),
    );
  });

  it("raises resource_not_found when insert returns no row", async () => {
    const { client } = createInsertClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = createResourceMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Iron Ore",
        slug: "iron-ore",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "resource_not_found" });
  });

  it("normalizes Supabase errors", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createResourceMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Iron Ore",
        slug: "iron-ore",
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("updateResourceMutationOptions", () => {
  it("rejects an update with no updatable fields before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateResourceMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        resourceId: RESOURCE_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "resource_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updates with trimmed name, scoped by id and world", async () => {
    const row = createResourceRow({ name: "Refined Iron" });
    const { client, calls } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateResourceMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      name: "  Refined Iron  ",
      resourceId: RESOURCE_ID,
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: RESOURCE_ID });
    expect(calls.from).toHaveBeenCalledWith("resources");
    expect(calls.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Refined Iron" }),
    );
    expect(calls.eqId).toHaveBeenCalledWith("id", RESOURCE_ID);
    expect(calls.eqWorld).toHaveBeenCalledWith("world_id", WORLD_ID);
    expect(options.mutationKey).toEqual(["resources", "update-resource"]);
  });

  it("updates only baseStockpileCap when only that is provided", async () => {
    const row = createResourceRow({ base_stockpile_cap: 999 });
    const { client, calls } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateResourceMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      baseStockpileCap: "999",
      resourceId: RESOURCE_ID,
      worldId: WORLD_ID,
    });

    expect(calls.update).toHaveBeenCalledWith({ base_stockpile_cap: 999 });
  });

  it("raises resource_not_found when update returns no row", async () => {
    const { client } = createUpdateClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = updateResourceMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Iron Ore",
        resourceId: RESOURCE_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "resource_not_found" });
  });

  it("normalizes Supabase errors", async () => {
    const { client } = createUpdateClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = updateResourceMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Iron Ore",
        resourceId: RESOURCE_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("softDeleteResourceMutationOptions", () => {
  it("rejects an invalid resourceId before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = softDeleteResourceMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        resourceId: "not-a-uuid",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "resource_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls soft_delete_resource RPC and returns resourceId, worldId, and cleanupSummary", async () => {
    const deleteRow: DeleteRow = {
      id: RESOURCE_ID,
      last_cleanup_summary_json: null,
      world_id: WORLD_ID,
    };
    const { client, calls } = createSoftDeleteClient({
      data: deleteRow,
      error: null,
    });
    const queryClient = createQueryClient();
    const options = softDeleteResourceMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      resourceId: RESOURCE_ID,
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({
      resourceId: RESOURCE_ID,
      worldId: WORLD_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith("soft_delete_resource", {
      p_resource_id: RESOURCE_ID,
      p_world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual(["resources", "soft-delete-resource"]);
  });

  it("parses cleanup summary with non-zero counts when references exist", async () => {
    const deleteRow: DeleteRow = {
      id: RESOURCE_ID,
      last_cleanup_summary_json: {
        building_tier_construction_costs_cleaned: 0,
        building_tier_effects_cleaned: 1,
        building_tier_upkeep_costs_cleaned: 0,
        cleaned_at: "2026-05-30T00:00:00.000Z",
        deposit_types_worker_inputs_cleaned: 2,
        job_definitions_inputs_cleaned: 3,
        job_definitions_outputs_cleaned: 0,
        managed_population_culling_outputs_cleaned: 0,
        managed_population_maintenance_cleaned: 0,
      },
      world_id: WORLD_ID,
    };
    const { client } = createSoftDeleteClient({ data: deleteRow, error: null });
    const queryClient = createQueryClient();
    const options = softDeleteResourceMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      resourceId: RESOURCE_ID,
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({
      cleanupSummary: {
        buildingTierEffectsCleaned: 1,
        depositTypesWorkerInputsCleaned: 2,
        jobDefinitionsInputsCleaned: 3,
        jobDefinitionsOutputsCleaned: 0,
      },
    });
  });

  it("returns all-zero cleanup summary when no references exist", async () => {
    const deleteRow: DeleteRow = {
      id: RESOURCE_ID,
      last_cleanup_summary_json: {
        building_tier_construction_costs_cleaned: 0,
        building_tier_effects_cleaned: 0,
        building_tier_upkeep_costs_cleaned: 0,
        cleaned_at: "2026-05-30T00:00:00.000Z",
        deposit_types_worker_inputs_cleaned: 0,
        job_definitions_inputs_cleaned: 0,
        job_definitions_outputs_cleaned: 0,
        managed_population_culling_outputs_cleaned: 0,
        managed_population_maintenance_cleaned: 0,
      },
      world_id: WORLD_ID,
    };
    const { client } = createSoftDeleteClient({ data: deleteRow, error: null });
    const queryClient = createQueryClient();
    const options = softDeleteResourceMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      resourceId: RESOURCE_ID,
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({
      cleanupSummary: {
        buildingTierConstructionCostsCleaned: 0,
        buildingTierEffectsCleaned: 0,
        buildingTierUpkeepCostsCleaned: 0,
        depositTypesWorkerInputsCleaned: 0,
        jobDefinitionsInputsCleaned: 0,
        jobDefinitionsOutputsCleaned: 0,
        managedPopulationCullingOutputsCleaned: 0,
        managedPopulationMaintenanceCleaned: 0,
      },
    });
  });

  it("raises resource_not_found when RPC returns no row", async () => {
    const { client } = createSoftDeleteClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = softDeleteResourceMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        resourceId: RESOURCE_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "resource_not_found" });
  });

  it("normalizes Supabase errors", async () => {
    const { client } = createSoftDeleteClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = softDeleteResourceMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        resourceId: RESOURCE_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("ResourceMutationError / isResourceMutationError", () => {
  it("identifies ResourceMutationError instances", () => {
    const err = new ResourceMutationError({
      code: "resource_not_found",
      message: "not found",
    });
    expect(isResourceMutationError(err)).toBe(true);
    expect(isResourceMutationError(new Error("other"))).toBe(false);
  });
});

function createResourceRow(overrides: Partial<ResourceRow> = {}): ResourceRow {
  return {
    base_stockpile_cap: 0,
    created_at: "2026-05-01T00:00:00.000Z",
    id: RESOURCE_ID,
    is_deleted: false,
    is_system_resource: false,
    last_cleanup_summary_json: null,
    name: "Iron Ore",
    slug: "iron-ore",
    updated_at: "2026-05-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createInsertClient(result: SupabaseResult<ResourceRow>): {
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

function createUpdateClient(result: SupabaseResult<ResourceRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly eqId: ReturnType<typeof vi.fn>;
    readonly eqWorld: ReturnType<typeof vi.fn>;
    readonly from: ReturnType<typeof vi.fn>;
    readonly update: ReturnType<typeof vi.fn>;
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
    calls: { eqId, eqWorld, from, update },
  };
}

function createSoftDeleteClient(result: SupabaseResult<DeleteRow>): {
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
