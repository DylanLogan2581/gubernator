import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createDepositTypeMutationOptions,
  updateDepositTypeMutationOptions,
} from "./depositsMutations";

const DEPOSIT_TYPE_ID = "11111111-1111-1111-1111-111111111111";
const JOB_ID = "22222222-2222-2222-2222-222222222222";
const REFERENCING_JOB_ID = "33333333-3333-3333-3333-333333333333";
const WORLD_ID = "44444444-4444-4444-4444-444444444444";

type DepositTypeRow = {
  readonly created_at: string;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly job_id: string;
  readonly name: string;
  readonly output_units_per_worker: number;
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly slug: string;
  readonly updated_at: string;
  readonly worker_inputs_json: ReadonlyArray<unknown>;
  readonly world_id: string;
};

describe("createDepositTypeMutationOptions — hasActiveReferences", () => {
  it("returns hasActiveReferences: false when no jobs reference the deposit type", async () => {
    const row = createDepositTypeRow({ referencing_jobs: [] });
    const { client } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createDepositTypeMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      jobId: JOB_ID,
      name: "Iron Deposit",
      outputUnitsPerWorker: 10,
      slug: "iron-deposit",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: false });
  });

  it("returns hasActiveReferences: true when at least one job references the deposit type", async () => {
    const row = createDepositTypeRow({
      referencing_jobs: [{ id: REFERENCING_JOB_ID }],
    });
    const { client } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createDepositTypeMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      jobId: JOB_ID,
      name: "Iron Deposit",
      outputUnitsPerWorker: 10,
      slug: "iron-deposit",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: true });
  });
});

describe("updateDepositTypeMutationOptions — hasActiveReferences", () => {
  it("returns hasActiveReferences: false when no jobs reference the deposit type", async () => {
    const row = createDepositTypeRow({ referencing_jobs: [] });
    const { client } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateDepositTypeMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      depositTypeId: DEPOSIT_TYPE_ID,
      name: "Iron Deposit",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: false });
  });

  it("returns hasActiveReferences: true when at least one job references the deposit type", async () => {
    const row = createDepositTypeRow({
      referencing_jobs: [{ id: REFERENCING_JOB_ID }],
    });
    const { client } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateDepositTypeMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      depositTypeId: DEPOSIT_TYPE_ID,
      name: "Iron Deposit",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: true });
  });
});

function createDepositTypeRow(
  overrides: Partial<DepositTypeRow> = {},
): DepositTypeRow {
  return {
    created_at: "2026-05-01T00:00:00.000Z",
    id: DEPOSIT_TYPE_ID,
    is_trashed: false,
    job_id: JOB_ID,
    name: "Iron Deposit",
    output_units_per_worker: 10,
    referencing_jobs: [],
    slug: "iron-deposit",
    updated_at: "2026-05-01T00:00:00.000Z",
    worker_inputs_json: [],
    world_id: WORLD_ID,
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createInsertClient(result: SupabaseResult<DepositTypeRow>): {
  readonly client: GubernatorSupabaseClient;
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as unknown as GubernatorSupabaseClient };
}

function createUpdateClient(result: SupabaseResult<DepositTypeRow>): {
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
