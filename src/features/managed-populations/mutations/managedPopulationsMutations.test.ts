import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createManagedPopulationTypeMutationOptions,
  updateManagedPopulationTypeMutationOptions,
} from "./managedPopulationsMutations";

const MPT_ID = "11111111-1111-1111-1111-111111111111";
const HUSBANDRY_JOB_ID = "22222222-2222-2222-2222-222222222222";
const CULLING_JOB_ID = "33333333-3333-3333-3333-333333333333";
const REFERENCING_JOB_ID = "44444444-4444-4444-4444-444444444444";
const WORLD_ID = "55555555-5555-5555-5555-555555555555";

type ManagedPopulationTypeRow = {
  readonly created_at: string;
  readonly culling_job_id: string;
  readonly culling_outputs_json: ReadonlyArray<unknown>;
  readonly growth_rate: number;
  readonly husbandry_job_id: string;
  readonly husbandry_workers_per_n_animals: number;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly maintenance_rules_json: ReadonlyArray<unknown>;
  readonly name: string;
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly regular_outputs_json: ReadonlyArray<unknown>;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

describe("createManagedPopulationTypeMutationOptions — hasActiveReferences", () => {
  it("returns hasActiveReferences: false when no jobs reference the managed population type", async () => {
    const row = createMptRow({ referencing_jobs: [] });
    const { client } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createManagedPopulationTypeMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      cullingJobId: CULLING_JOB_ID,
      growthRate: 1.05,
      husbandryJobId: HUSBANDRY_JOB_ID,
      husbandryWorkersPerNAnimals: 10,
      name: "Cattle",
      slug: "cattle",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: false });
  });

  it("returns hasActiveReferences: true when at least one job references the managed population type", async () => {
    const row = createMptRow({
      referencing_jobs: [{ id: REFERENCING_JOB_ID }],
    });
    const { client } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createManagedPopulationTypeMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      cullingJobId: CULLING_JOB_ID,
      growthRate: 1.05,
      husbandryJobId: HUSBANDRY_JOB_ID,
      husbandryWorkersPerNAnimals: 10,
      name: "Cattle",
      slug: "cattle",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: true });
  });
});

describe("updateManagedPopulationTypeMutationOptions — hasActiveReferences", () => {
  it("returns hasActiveReferences: false when no jobs reference the managed population type", async () => {
    const row = createMptRow({ referencing_jobs: [] });
    const { client } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateManagedPopulationTypeMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      managedPopulationTypeId: MPT_ID,
      name: "Cattle",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: false });
  });

  it("returns hasActiveReferences: true when at least one job references the managed population type", async () => {
    const row = createMptRow({
      referencing_jobs: [{ id: REFERENCING_JOB_ID }],
    });
    const { client } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateManagedPopulationTypeMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      managedPopulationTypeId: MPT_ID,
      name: "Cattle",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: true });
  });
});

function createMptRow(
  overrides: Partial<ManagedPopulationTypeRow> = {},
): ManagedPopulationTypeRow {
  return {
    created_at: "2026-05-01T00:00:00.000Z",
    culling_job_id: CULLING_JOB_ID,
    culling_outputs_json: [],
    growth_rate: 1.05,
    husbandry_job_id: HUSBANDRY_JOB_ID,
    husbandry_workers_per_n_animals: 10,
    id: MPT_ID,
    is_trashed: false,
    maintenance_rules_json: [],
    name: "Cattle",
    referencing_jobs: [],
    regular_outputs_json: [],
    slug: "cattle",
    updated_at: "2026-05-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createInsertClient(result: SupabaseResult<ManagedPopulationTypeRow>): {
  readonly client: GubernatorSupabaseClient;
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as unknown as GubernatorSupabaseClient };
}

function createUpdateClient(result: SupabaseResult<ManagedPopulationTypeRow>): {
  readonly client: GubernatorSupabaseClient;
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eqWorld = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqWorld }));
  const update = vi.fn(() => ({ eq: eqId }));
  const from = vi.fn(() => ({ update }));
  return { client: { from } as unknown as GubernatorSupabaseClient };
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
