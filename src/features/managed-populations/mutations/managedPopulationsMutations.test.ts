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

type ManagedPopulationHusbandryJobRow = {
  readonly id: string;
  readonly job_id: string;
  readonly workers_per_n_animals: number;
};

type ManagedPopulationCullingJobRow = {
  readonly id: string;
  readonly job_id: string;
  readonly max_cull_per_worker: number;
};

type ManagedPopulationTypeRow = {
  readonly created_at: string;
  readonly culling_outputs_json: ReadonlyArray<unknown>;
  readonly growth_rate: number;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly maintenance_rules_json: ReadonlyArray<unknown>;
  readonly managed_population_culling_jobs: readonly ManagedPopulationCullingJobRow[];
  readonly managed_population_husbandry_jobs: readonly ManagedPopulationHusbandryJobRow[];
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
    const { client } = createInsertClient(row);
    const queryClient = createQueryClient();
    const options = createManagedPopulationTypeMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      cullingJobs: [{ jobId: CULLING_JOB_ID, maxCullPerWorker: 5 }],
      growthRate: 1.05,
      husbandryJobs: [{ jobId: HUSBANDRY_JOB_ID, workersPerNAnimals: 10 }],
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
    const { client } = createInsertClient(row);
    const queryClient = createQueryClient();
    const options = createManagedPopulationTypeMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      cullingJobs: [{ jobId: CULLING_JOB_ID, maxCullPerWorker: 5 }],
      growthRate: 1.05,
      husbandryJobs: [{ jobId: HUSBANDRY_JOB_ID, workersPerNAnimals: 10 }],
      name: "Cattle",
      slug: "cattle",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: true });
  });

  it("maps multiple linked husbandry and culling jobs onto the created managed population type", async () => {
    const row = createMptRow({
      managed_population_culling_jobs: [
        {
          id: "culling-job-row-1",
          job_id: CULLING_JOB_ID,
          max_cull_per_worker: 5,
        },
        {
          id: "culling-job-row-2",
          job_id: REFERENCING_JOB_ID,
          max_cull_per_worker: 7,
        },
      ],
      managed_population_husbandry_jobs: [
        {
          id: "husbandry-job-row-1",
          job_id: HUSBANDRY_JOB_ID,
          workers_per_n_animals: 10,
        },
        {
          id: "husbandry-job-row-2",
          job_id: REFERENCING_JOB_ID,
          workers_per_n_animals: 20,
        },
      ],
    });
    const { client } = createInsertClient(row);
    const queryClient = createQueryClient();
    const options = createManagedPopulationTypeMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      cullingJobs: [
        { jobId: CULLING_JOB_ID, maxCullPerWorker: 5 },
        { jobId: REFERENCING_JOB_ID, maxCullPerWorker: 7 },
      ],
      growthRate: 1.05,
      husbandryJobs: [
        { jobId: HUSBANDRY_JOB_ID, workersPerNAnimals: 10 },
        { jobId: REFERENCING_JOB_ID, workersPerNAnimals: 20 },
      ],
      name: "Cattle",
      slug: "cattle",
      worldId: WORLD_ID,
    });

    expect(
      (result as { husbandryJobs: readonly unknown[] }).husbandryJobs,
    ).toHaveLength(2);
    expect(
      (result as { cullingJobs: readonly unknown[] }).cullingJobs,
    ).toHaveLength(2);
  });
});

describe("updateManagedPopulationTypeMutationOptions — hasActiveReferences", () => {
  it("returns hasActiveReferences: false when no jobs reference the managed population type", async () => {
    const row = createMptRow({ referencing_jobs: [] });
    const { client } = createUpdateClient(row);
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
    const { client } = createUpdateClient(row);
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
    culling_outputs_json: [],
    growth_rate: 1.05,
    id: MPT_ID,
    is_trashed: false,
    maintenance_rules_json: [],
    managed_population_culling_jobs: [
      {
        id: "culling-job-row-1",
        job_id: CULLING_JOB_ID,
        max_cull_per_worker: 5,
      },
    ],
    managed_population_husbandry_jobs: [
      {
        id: "husbandry-job-row-1",
        job_id: HUSBANDRY_JOB_ID,
        workers_per_n_animals: 10,
      },
    ],
    name: "Cattle",
    referencing_jobs: [],
    regular_outputs_json: [],
    slug: "cattle",
    updated_at: "2026-05-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createInsertClient(fetchedRow: ManagedPopulationTypeRow): {
  readonly client: GubernatorSupabaseClient;
} {
  const insertMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { id: MPT_ID }, error: null });
  const insertSelect = vi.fn(() => ({ maybeSingle: insertMaybeSingle }));
  const managedPopulationTypesInsert = vi.fn(() => ({ select: insertSelect }));

  const fetchMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: fetchedRow, error: null });
  const fetchEq = vi.fn(() => ({ maybeSingle: fetchMaybeSingle }));
  const fetchSelect = vi.fn(() => ({ eq: fetchEq }));

  const husbandryJobsInsert = vi.fn().mockResolvedValue({ error: null });
  const cullingJobsInsert = vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn((table: string) => {
    if (table === "managed_population_types") {
      return { insert: managedPopulationTypesInsert, select: fetchSelect };
    }
    if (table === "managed_population_husbandry_jobs") {
      return { insert: husbandryJobsInsert };
    }
    if (table === "managed_population_culling_jobs") {
      return { insert: cullingJobsInsert };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { client: { from } as unknown as GubernatorSupabaseClient };
}

function createUpdateClient(fetchedRow: ManagedPopulationTypeRow): {
  readonly client: GubernatorSupabaseClient;
} {
  const updateMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { id: MPT_ID }, error: null });
  const updateSelect = vi.fn(() => ({ maybeSingle: updateMaybeSingle }));
  const updateEqWorld = vi.fn(() => ({ select: updateSelect }));
  const updateEqId = vi.fn(() => ({ eq: updateEqWorld }));
  const managedPopulationTypesUpdate = vi.fn(() => ({ eq: updateEqId }));

  const fetchMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: fetchedRow, error: null });
  const fetchEq = vi.fn(() => ({ maybeSingle: fetchMaybeSingle }));
  const fetchSelect = vi.fn(() => ({ eq: fetchEq }));

  const from = vi.fn((table: string) => {
    if (table === "managed_population_types") {
      return { select: fetchSelect, update: managedPopulationTypesUpdate };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

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
