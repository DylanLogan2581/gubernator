import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createUnitTypeMutationOptions,
  deleteUnitTypeMutationOptions,
  isUnitTypeMutationError,
  updateUnitTypeMutationOptions,
} from "./unitTypesMutations";

const UNIT_TYPE_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";

type UnitTypeRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly desertion_rate: number;
  readonly id: string;
  readonly name: string;
  readonly recruitment_costs_json: readonly unknown[];
  readonly required_building_blueprint_id: string | null;
  readonly required_building_tier_number: number | null;
  readonly required_education_level_id: string | null;
  readonly soldiers_per_unit: number;
  readonly updated_at: string;
  readonly upkeep_costs_json: readonly unknown[];
  readonly world_id: string;
};

describe("createUnitTypeMutationOptions", () => {
  it("rejects a blank name before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createUnitTypeMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        desertionRate: 0,
        name: "   ",
        soldiersPerUnit: 1,
        worldId: WORLD_ID,
      }),
    ).rejects.toSatisfy(isUnitTypeMutationError);
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts with trimmed name and null optional fields", async () => {
    const row = createUnitTypeRow();
    const { client, calls } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createUnitTypeMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      desertionRate: 0.1,
      name: "  Levy  ",
      soldiersPerUnit: 10,
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: UNIT_TYPE_ID, name: row.name });
    expect(calls.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        desertion_rate: 0.1,
        name: "Levy",
        required_building_blueprint_id: null,
        required_building_tier_number: null,
        required_education_level_id: null,
        soldiers_per_unit: 10,
        world_id: WORLD_ID,
      }),
    );
  });

  it("maps a 23505 unique violation to unit_type_name_taken", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    const queryClient = createQueryClient();
    const options = createUnitTypeMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        desertionRate: 0,
        name: "Levy",
        soldiersPerUnit: 1,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "unit_type_name_taken" });
  });

  it("maps a 23503 fk violation to unit_type_invalid_reference on write", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "23503", message: "violates foreign key constraint" },
    });
    const queryClient = createQueryClient();
    const options = createUnitTypeMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        desertionRate: 0,
        name: "Levy",
        soldiersPerUnit: 1,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "unit_type_invalid_reference" });
  });
});

describe("updateUnitTypeMutationOptions", () => {
  it("only includes changed fields in the update payload", async () => {
    const row = createUnitTypeRow({ name: "Spearman" });
    const { client, calls } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateUnitTypeMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      name: "Spearman",
      unitTypeId: UNIT_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(calls.update).toHaveBeenCalledWith({ name: "Spearman" });
  });
});

describe("deleteUnitTypeMutationOptions", () => {
  it("maps a 23503 fk violation to unit_type_in_use on delete", async () => {
    const { client } = createDeleteClient({
      data: null,
      error: { code: "23503", message: "violates foreign key constraint" },
    });
    const queryClient = createQueryClient();
    const options = deleteUnitTypeMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        unitTypeId: UNIT_TYPE_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "unit_type_in_use" });
  });

  it("resolves with the deleted unit type id and world id", async () => {
    const { client } = createDeleteClient({
      data: { id: UNIT_TYPE_ID, world_id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = deleteUnitTypeMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      unitTypeId: UNIT_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ unitTypeId: UNIT_TYPE_ID, worldId: WORLD_ID });
  });
});

function createUnitTypeRow(overrides: Partial<UnitTypeRow> = {}): UnitTypeRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    description: null,
    desertion_rate: 0.1,
    id: UNIT_TYPE_ID,
    name: "Levy",
    recruitment_costs_json: [],
    required_building_blueprint_id: null,
    required_building_tier_number: null,
    required_education_level_id: null,
    soldiers_per_unit: 10,
    updated_at: "2026-01-01T00:00:00.000Z",
    upkeep_costs_json: [],
    world_id: WORLD_ID,
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createInsertClient(result: SupabaseResult<UnitTypeRow>): {
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

function createUpdateClient(result: SupabaseResult<UnitTypeRow>): {
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

function createDeleteClient(
  result: SupabaseResult<{ readonly id: string; readonly world_id: string }>,
): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly eqId: ReturnType<typeof vi.fn>;
    readonly eqWorld: ReturnType<typeof vi.fn>;
    readonly from: ReturnType<typeof vi.fn>;
  };
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eqWorld = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqWorld }));
  const deleteFn = vi.fn(() => ({ eq: eqId }));
  const from = vi.fn(() => ({ delete: deleteFn }));
  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    calls: { eqId, eqWorld, from },
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
