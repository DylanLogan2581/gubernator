import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createJobMutationOptions,
  updateJobMutationOptions,
} from "./jobsMutations";

const JOB_ID = "11111111-1111-1111-1111-111111111111";
const DEPOSIT_TYPE_ID = "22222222-2222-2222-2222-222222222222";
const MANAGED_POP_TYPE_ID = "33333333-3333-3333-3333-333333333333";
const WORLD_ID = "44444444-4444-4444-4444-444444444444";

type JobRow = {
  readonly base_capacity: number | null;
  readonly created_at: string;
  readonly culling_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly deposit_types: ReadonlyArray<{ readonly id: string }>;
  readonly husbandry_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly id: string;
  readonly inputs_json: ReadonlyArray<unknown>;
  readonly is_trashed: boolean;
  readonly job_type: string;
  readonly linked_deposit_type_id: string | null;
  readonly linked_managed_population_type_id: string | null;
  readonly name: string;
  readonly outputs_json: ReadonlyArray<unknown>;
  readonly slug: string;
  readonly trader_capacity_per_worker: number | null;
  readonly updated_at: string;
  readonly world_id: string;
};

describe("createJobMutationOptions — hasActiveReferences", () => {
  it("returns hasActiveReferences: false when no references exist", async () => {
    const row = createJobRow({
      deposit_types: [],
      husbandry_mpt: [],
      culling_mpt: [],
    });
    const { client } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createJobMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      jobType: "standard",
      name: "Logging",
      slug: "logging",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: false });
  });

  it("returns hasActiveReferences: true when a deposit type references the job", async () => {
    const row = createJobRow({
      deposit_types: [{ id: DEPOSIT_TYPE_ID }],
      husbandry_mpt: [],
      culling_mpt: [],
    });
    const { client } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createJobMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      jobType: "standard",
      name: "Logging",
      slug: "logging",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: true });
  });

  it("returns hasActiveReferences: true when a managed population type references the job via husbandry", async () => {
    const row = createJobRow({
      deposit_types: [],
      husbandry_mpt: [{ id: MANAGED_POP_TYPE_ID }],
      culling_mpt: [],
    });
    const { client } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createJobMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      jobType: "standard",
      name: "Logging",
      slug: "logging",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: true });
  });

  it("returns hasActiveReferences: true when a managed population type references the job via culling", async () => {
    const row = createJobRow({
      deposit_types: [],
      husbandry_mpt: [],
      culling_mpt: [{ id: MANAGED_POP_TYPE_ID }],
    });
    const { client } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createJobMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      jobType: "standard",
      name: "Logging",
      slug: "logging",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: true });
  });
});

describe("updateJobMutationOptions — hasActiveReferences", () => {
  it("returns hasActiveReferences: false when no references exist", async () => {
    const row = createJobRow({
      deposit_types: [],
      husbandry_mpt: [],
      culling_mpt: [],
    });
    const { client } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateJobMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      jobId: JOB_ID,
      name: "Logging",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: false });
  });

  it("returns hasActiveReferences: true when a deposit type references the job", async () => {
    const row = createJobRow({
      deposit_types: [{ id: DEPOSIT_TYPE_ID }],
      husbandry_mpt: [],
      culling_mpt: [],
    });
    const { client } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateJobMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      jobId: JOB_ID,
      name: "Logging",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: true });
  });
});

function createJobRow(overrides: Partial<JobRow> = {}): JobRow {
  return {
    base_capacity: null,
    created_at: "2026-05-01T00:00:00.000Z",
    culling_mpt: [],
    deposit_types: [],
    husbandry_mpt: [],
    id: JOB_ID,
    inputs_json: [],
    is_trashed: false,
    job_type: "standard",
    linked_deposit_type_id: null,
    linked_managed_population_type_id: null,
    name: "Logging",
    outputs_json: [],
    slug: "logging",
    trader_capacity_per_worker: null,
    updated_at: "2026-05-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createInsertClient(result: SupabaseResult<JobRow>): {
  readonly client: GubernatorSupabaseClient;
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as unknown as GubernatorSupabaseClient };
}

function createUpdateClient(result: SupabaseResult<JobRow>): {
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
