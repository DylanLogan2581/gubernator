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

type DepositTypeJobRow = {
  readonly id: string;
  readonly job_id: string;
  readonly tier_number: number;
  readonly output_units_per_worker: number;
  readonly worker_inputs_json: readonly unknown[];
};

type DepositTypeRow = {
  readonly created_at: string;
  readonly deposit_type_jobs: readonly DepositTypeJobRow[];
  readonly id: string;
  readonly is_trashed: boolean;
  readonly name: string;
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

function createDepositTypeRow(
  overrides: Partial<DepositTypeRow> = {},
): DepositTypeRow {
  return {
    created_at: "2026-05-01T00:00:00.000Z",
    deposit_type_jobs: [
      {
        id: "job-row-1",
        job_id: JOB_ID,
        tier_number: 1,
        output_units_per_worker: 10,
        worker_inputs_json: [],
      },
    ],
    id: DEPOSIT_TYPE_ID,
    is_trashed: false,
    name: "Iron Deposit",
    referencing_jobs: [],
    slug: "iron-deposit",
    updated_at: "2026-05-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

describe("createDepositTypeMutationOptions — hasActiveReferences", () => {
  it("returns hasActiveReferences: false when no jobs reference the deposit type", async () => {
    const row = createDepositTypeRow({ referencing_jobs: [] });
    const { client } = createInsertClient(row);
    const queryClient = createQueryClient();
    const options = createDepositTypeMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      jobs: [
        {
          jobId: JOB_ID,
          tierNumber: 1,
          outputUnitsPerWorker: 10,
          workerInputsJson: [],
        },
      ],
      name: "Iron Deposit",
      slug: "iron-deposit",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: false });
  });

  it("returns hasActiveReferences: true when at least one job references the deposit type", async () => {
    const row = createDepositTypeRow({
      referencing_jobs: [{ id: REFERENCING_JOB_ID }],
    });
    const { client } = createInsertClient(row);
    const queryClient = createQueryClient();
    const options = createDepositTypeMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      jobs: [
        {
          jobId: JOB_ID,
          tierNumber: 1,
          outputUnitsPerWorker: 10,
          workerInputsJson: [],
        },
      ],
      name: "Iron Deposit",
      slug: "iron-deposit",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ hasActiveReferences: true });
  });

  it("maps multiple linked jobs onto the created deposit type", async () => {
    const row = createDepositTypeRow({
      deposit_type_jobs: [
        {
          id: "job-row-1",
          job_id: JOB_ID,
          tier_number: 1,
          output_units_per_worker: 10,
          worker_inputs_json: [],
        },
        {
          id: "job-row-2",
          job_id: REFERENCING_JOB_ID,
          tier_number: 2,
          output_units_per_worker: 20,
          worker_inputs_json: [],
        },
      ],
    });
    const { client } = createInsertClient(row);
    const queryClient = createQueryClient();
    const options = createDepositTypeMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      jobs: [
        {
          jobId: JOB_ID,
          tierNumber: 1,
          outputUnitsPerWorker: 10,
          workerInputsJson: [],
        },
        {
          jobId: REFERENCING_JOB_ID,
          tierNumber: 2,
          outputUnitsPerWorker: 20,
          workerInputsJson: [],
        },
      ],
      name: "Iron Deposit",
      slug: "iron-deposit",
      worldId: WORLD_ID,
    });

    expect((result as { jobs: readonly unknown[] }).jobs).toHaveLength(2);
  });
});

describe("updateDepositTypeMutationOptions — hasActiveReferences", () => {
  it("returns hasActiveReferences: false when no jobs reference the deposit type", async () => {
    const row = createDepositTypeRow({ referencing_jobs: [] });
    const { client } = createUpdateClient(row);
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
    const { client } = createUpdateClient(row);
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

function createInsertClient(fetchedRow: DepositTypeRow): {
  readonly client: GubernatorSupabaseClient;
} {
  const insertMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { id: DEPOSIT_TYPE_ID }, error: null });
  const insertSelect = vi.fn(() => ({ maybeSingle: insertMaybeSingle }));
  const depositTypesInsert = vi.fn(() => ({ select: insertSelect }));

  const fetchMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: fetchedRow, error: null });
  const fetchEq = vi.fn(() => ({ maybeSingle: fetchMaybeSingle }));
  const fetchSelect = vi.fn(() => ({ eq: fetchEq }));

  const jobsInsert = vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn((table: string) => {
    if (table === "deposit_types") {
      return { insert: depositTypesInsert, select: fetchSelect };
    }
    if (table === "deposit_type_jobs") {
      return { insert: jobsInsert };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { client: { from } as unknown as GubernatorSupabaseClient };
}

function createUpdateClient(fetchedRow: DepositTypeRow): {
  readonly client: GubernatorSupabaseClient;
} {
  const updateMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { id: DEPOSIT_TYPE_ID }, error: null });
  const updateSelect = vi.fn(() => ({ maybeSingle: updateMaybeSingle }));
  const updateEqWorld = vi.fn(() => ({ select: updateSelect }));
  const updateEqId = vi.fn(() => ({ eq: updateEqWorld }));
  const depositTypesUpdate = vi.fn(() => ({ eq: updateEqId }));

  const fetchMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: fetchedRow, error: null });
  const fetchEq = vi.fn(() => ({ maybeSingle: fetchMaybeSingle }));
  const fetchSelect = vi.fn(() => ({ eq: fetchEq }));

  const from = vi.fn((table: string) => {
    if (table === "deposit_types") {
      return { update: depositTypesUpdate, select: fetchSelect };
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
