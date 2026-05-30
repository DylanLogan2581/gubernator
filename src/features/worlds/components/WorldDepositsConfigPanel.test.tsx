import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorldDepositsConfigPanel } from "./WorldDepositsConfigPanel";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn<(message: string) => void>(),
  toastSuccess:
    vi.fn<(message: string, options?: { description?: string }) => void>(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const DEPOSIT_TYPE_ID = "00000000-0000-0000-0000-000000000002";
const JOB_ID = "00000000-0000-0000-0000-000000000003";
const JOB_ID_2 = "00000000-0000-0000-0000-000000000004";
const RESOURCE_ID = "00000000-0000-0000-0000-000000000005";

describe("WorldDepositsConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("shows empty state when there are no deposit types", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ depositTypeRows: [], jobRows: [], resourceRows: [] }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText("No deposit types yet")).toBeDefined();
  });

  it("hides the Add deposit type button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ depositTypeRows: [], jobRows: [], resourceRows: [] }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("No deposit types yet");
    expect(
      screen.queryByRole("button", { name: "Add deposit type" }),
    ).toBeNull();
  });

  it("shows deposit types with name and output per worker", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({
            name: "Iron Ore",
            output_units_per_worker: 5,
          }),
        ],
        jobRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Iron Ore");
    expect(screen.getByText(/5 output\/worker/)).toBeDefined();
  });

  it("shows linked job name in the row", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({ job_id: JOB_ID, name: "Iron Ore" }),
        ],
        jobRows: [createJobRow({ id: JOB_ID, name: "Iron Mining" })],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Iron Ore");
    expect(await screen.findByText(/Iron Mining/)).toBeDefined();
  });

  it("shows trashed deposit types when trash view is toggled", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({ is_active: true, name: "Active Deposit" }),
          createDepositTypeRow({
            id: "00000000-0000-0000-0000-000000000010",
            is_active: false,
            name: "Trashed Deposit",
          }),
        ],
        jobRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Active Deposit");
    expect(screen.queryByText("Trashed Deposit")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show trash" }));

    expect(screen.getByText("Trashed Deposit")).toBeDefined();
    expect(screen.getByRole("button", { name: "Hide trash" })).toBeDefined();
  });

  it("emits a success toast after creating a deposit type", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [],
        insertResult: {
          data: createDepositTypeRow({ name: "Coal Seam" }),
          error: null,
        },
        jobRows: [createJobRow({ id: JOB_ID, name: "Coal Mining" })],
        resourceRows: [createResourceRow({ name: "Coal" })],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Deposit Types" });
    await user.click(screen.getByRole("button", { name: "Add deposit type" }));

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Coal Seam");
    await user.clear(screen.getByRole("textbox", { name: "Slug" }));
    await user.type(screen.getByRole("textbox", { name: "Slug" }), "coal-seam");

    const jobSelect = screen.getByRole("combobox", {
      name: "Linked deposit job",
    });
    await user.selectOptions(jobSelect, JOB_ID);

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Deposit type created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("emits a success toast after editing a deposit type", async () => {
    const user = userEvent.setup();
    const depositTypeRow = createDepositTypeRow({
      job_id: JOB_ID,
      name: "Iron Ore",
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [depositTypeRow],
        jobRows: [createJobRow({ id: JOB_ID, name: "Iron Mining" })],
        resourceRows: [],
        updateResult: {
          data: depositTypeRow,
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Iron Ore");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit deposit type" });
    const nameInput = screen.getByRole("textbox", { name: "Name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Iron Ore Deposit");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Deposit type saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows inline error when selected job is already linked to another deposit type", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({
            job_id: JOB_ID,
            name: "Iron Ore",
          }),
        ],
        jobRows: [
          createJobRow({ id: JOB_ID, name: "Iron Mining" }),
          createJobRow({ id: JOB_ID_2, name: "Coal Mining" }),
        ],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Deposit Types" });
    await user.click(screen.getByRole("button", { name: "Add deposit type" }));

    await screen.findByRole("heading", { name: "New deposit type" });
    const jobSelect = screen.getByRole("combobox", {
      name: "Linked deposit job",
    });
    await user.selectOptions(jobSelect, JOB_ID);

    expect(
      screen.getByText('This job is already linked to "Iron Ore".'),
    ).toBeDefined();

    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("shows inline error in edit form when job is already linked to a different deposit type", async () => {
    const user = userEvent.setup();
    const depositTypeRow = createDepositTypeRow({
      job_id: JOB_ID,
      name: "Iron Ore",
    });
    const otherDepositTypeRow = createDepositTypeRow({
      id: "00000000-0000-0000-0000-000000000020",
      job_id: JOB_ID_2,
      name: "Coal Seam",
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [depositTypeRow, otherDepositTypeRow],
        jobRows: [
          createJobRow({ id: JOB_ID, name: "Iron Mining" }),
          createJobRow({ id: JOB_ID_2, name: "Coal Mining" }),
        ],
        resourceRows: [],
        updateResult: { data: depositTypeRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Iron Ore");
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);

    await screen.findByRole("heading", { name: "Edit deposit type" });
    const jobSelect = screen.getByRole("combobox", {
      name: "Linked deposit job",
    });
    await user.selectOptions(jobSelect, JOB_ID_2);

    expect(
      screen.getByText('This job is already linked to "Coal Seam".'),
    ).toBeDefined();

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("hides the Edit button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [createDepositTypeRow({ name: "Iron Ore" })],
        jobRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Iron Ore");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("moves a deposit type to trash via the inline row button", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [createDepositTypeRow({ name: "Iron Ore" })],
        jobRows: [],
        resourceRows: [],
        rpcResult: {
          data: { id: DEPOSIT_TYPE_ID, world_id: WORLD_ID },
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Iron Ore");
    await user.click(
      screen.getByRole("button", { name: "Move Iron Ore to trash" }),
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Deposit type moved to trash.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("hides the inline trash button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [createDepositTypeRow({ name: "Iron Ore" })],
        jobRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Iron Ore");
    expect(
      screen.queryByRole("button", { name: "Move Iron Ore to trash" }),
    ).toBeNull();
  });
});

function renderPanel({
  canAdmin,
  isArchived,
}: {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <WorldDepositsConfigPanel
        canAdmin={canAdmin}
        isArchived={isArchived}
        worldId={WORLD_ID}
      />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

type TestDepositTypeRow = {
  readonly created_at: string;
  readonly id: string;
  readonly is_active: boolean;
  readonly job_id: string;
  readonly name: string;
  readonly output_units_per_worker: number;
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly slug: string;
  readonly updated_at: string;
  readonly worker_inputs_json: readonly unknown[];
  readonly world_id: string;
};

type TestJobRow = {
  readonly base_capacity: number | null;
  readonly created_at: string;
  readonly culling_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly deposit_types: ReadonlyArray<{ readonly id: string }>;
  readonly husbandry_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly id: string;
  readonly inputs_json: readonly unknown[];
  readonly is_active: boolean;
  readonly job_type: string;
  readonly linked_deposit_type_id: string | null;
  readonly linked_managed_population_type_id: string | null;
  readonly name: string;
  readonly outputs_json: readonly unknown[];
  readonly slug: string;
  readonly trader_capacity_per_worker: number | null;
  readonly updated_at: string;
  readonly world_id: string;
};

type TestResourceRow = {
  readonly base_stockpile_cap: number;
  readonly created_at: string;
  readonly id: string;
  readonly is_deleted: boolean;
  readonly is_system_resource: boolean;
  readonly last_cleanup_summary_json: null;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

function createDepositTypeRow(
  overrides: Partial<TestDepositTypeRow> = {},
): TestDepositTypeRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    id: DEPOSIT_TYPE_ID,
    is_active: true,
    job_id: JOB_ID,
    name: "Test Deposit",
    output_units_per_worker: 1,
    referencing_jobs: [],
    slug: "test-deposit",
    updated_at: "2026-01-01T00:00:00.000Z",
    worker_inputs_json: [],
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createJobRow(overrides: Partial<TestJobRow> = {}): TestJobRow {
  return {
    base_capacity: null,
    created_at: "2026-01-01T00:00:00.000Z",
    culling_mpt: [],
    deposit_types: [],
    husbandry_mpt: [],
    id: JOB_ID,
    inputs_json: [],
    is_active: true,
    job_type: "deposit",
    linked_deposit_type_id: null,
    linked_managed_population_type_id: null,
    name: "Test Deposit Job",
    outputs_json: [],
    slug: "test-deposit-job",
    trader_capacity_per_worker: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createResourceRow(
  overrides: Partial<TestResourceRow> = {},
): TestResourceRow {
  return {
    base_stockpile_cap: 1000,
    created_at: "2026-01-01T00:00:00.000Z",
    id: RESOURCE_ID,
    is_deleted: false,
    is_system_resource: false,
    last_cleanup_summary_json: null,
    name: "Iron",
    slug: "iron",
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createClient({
  depositTypeRows,
  insertResult = { data: createDepositTypeRow(), error: null },
  jobRows,
  resourceRows,
  rpcResult = { data: null, error: null },
  updateResult = { data: createDepositTypeRow(), error: null },
}: {
  readonly depositTypeRows: readonly TestDepositTypeRow[];
  readonly insertResult?: {
    readonly data: TestDepositTypeRow | null;
    readonly error: { readonly message: string } | null;
  };
  readonly jobRows: readonly TestJobRow[];
  readonly resourceRows: readonly TestResourceRow[];
  readonly rpcResult?: {
    readonly data: { readonly id: string; readonly world_id: string } | null;
    readonly error: { readonly message: string } | null;
  };
  readonly updateResult?: {
    readonly data: TestDepositTypeRow | null;
    readonly error: { readonly message: string } | null;
  };
}): {
  readonly from: ReturnType<typeof vi.fn>;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "deposit_types") {
        return createDepositTypesQueryBuilder(
          depositTypeRows,
          insertResult,
          updateResult,
        );
      }
      if (table === "job_definitions") {
        return createJobsQueryBuilder(jobRows);
      }
      if (table === "resources") {
        return createResourcesQueryBuilder(resourceRows);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue(rpcResult),
    })),
  };
}

function createDepositTypesQueryBuilder(
  rows: readonly TestDepositTypeRow[],
  insertResult: {
    readonly data: TestDepositTypeRow | null;
    readonly error: { readonly message: string } | null;
  },
  updateResult: {
    readonly data: TestDepositTypeRow | null;
    readonly error: { readonly message: string } | null;
  },
): unknown {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  const updateBuilder: Record<string, unknown> = {
    eq: vi.fn(() => updateBuilder),
    select: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue(updateResult),
    })),
  };

  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue(insertResult),
      })),
    })),
    select: vi.fn(() => selectBuilder),
    update: vi.fn(() => updateBuilder),
  };
}

function createJobsQueryBuilder(rows: readonly TestJobRow[]): unknown {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return {
    select: vi.fn(() => selectBuilder),
  };
}

function createResourcesQueryBuilder(
  rows: readonly TestResourceRow[],
): unknown {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return {
    select: vi.fn(() => selectBuilder),
  };
}
