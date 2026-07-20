import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DepositsConfigPanel } from "./DepositsConfigPanel";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <a className={className}>{children}</a>,
}));

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

describe("DepositsConfigPanel", () => {
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

  it("shows deposit types with a linked job count and name", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({
            name: "Iron Ore",
            deposit_type_jobs: [createDepositTypeJobRow({ job_id: JOB_ID })],
          }),
        ],
        jobRows: [createJobRow({ id: JOB_ID, name: "Iron Mining" })],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Iron Ore");
    const row = screen.getByText("Iron Ore").closest("tr");
    expect(row).toHaveTextContent("1 job");
    expect(row).toHaveTextContent("Iron Mining");
  });

  it("shows a plural job count and comma-joined names for multiple linked jobs", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({
            name: "Iron Ore",
            deposit_type_jobs: [
              createDepositTypeJobRow({ id: "row-1", job_id: JOB_ID }),
              createDepositTypeJobRow({
                id: "row-2",
                job_id: JOB_ID_2,
                tier_number: 2,
              }),
            ],
          }),
        ],
        jobRows: [
          createJobRow({ id: JOB_ID, name: "Iron Mining" }),
          createJobRow({ id: JOB_ID_2, name: "Skilled Iron Mining" }),
        ],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Iron Ore");
    const row = screen.getByText("Iron Ore").closest("tr");
    expect(row).toHaveTextContent("2 jobs");
    expect(row).toHaveTextContent("T1: Iron Mining, T2: Skilled Iron Mining");
  });

  it("shows empty state with create link when no deposit jobs exist in create form", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({ depositTypeRows: [], jobRows: [], resourceRows: [] }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Deposit Types" });
    await user.click(screen.getByRole("button", { name: "Add deposit type" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create deposit type",
    });
    expect(within(dialog).getByText("No deposit jobs yet")).toBeDefined();
    expect(within(dialog).getByText("Create deposit job")).toBeDefined();
    expect(
      within(dialog).queryByRole("combobox", { name: /linked job/i }),
    ).toBeNull();
  });

  it("shows empty state with create link when no deposit jobs exist in edit form", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [createDepositTypeRow({ name: "Iron Ore" })],
        jobRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Iron Ore");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit deposit type" });
    expect(screen.getByText("No deposit jobs yet")).toBeDefined();
    expect(screen.getByText("Create deposit job")).toBeDefined();
    expect(screen.queryByRole("combobox", { name: /linked job/i })).toBeNull();
  });

  it("shows trashed deposit types when trash view is toggled", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({ is_trashed: false, name: "Active Deposit" }),
          createDepositTypeRow({
            id: "00000000-0000-0000-0000-000000000010",
            is_trashed: true,
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

  it("emits a success toast after creating a deposit type with one linked job", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [],
        fetchedRow: createDepositTypeRow({ name: "Coal Seam" }),
        jobRows: [createJobRow({ id: JOB_ID, name: "Coal Mining" })],
        resourceRows: [createResourceRow({ name: "Coal" })],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Deposit Types" });
    await user.click(screen.getByRole("button", { name: "Add deposit type" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create deposit type",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Coal Seam",
    );

    expect(within(dialog).getByText("slug: coal-seam")).toBeDefined();

    const jobSelect = within(dialog).getByRole("combobox", {
      name: "Job 1 linked job",
    });
    await user.selectOptions(jobSelect, JOB_ID);

    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Deposit type created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("supports adding a second job row and disables submit on duplicate selection", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [],
        jobRows: [
          createJobRow({ id: JOB_ID, name: "Coal Mining" }),
          createJobRow({ id: JOB_ID_2, name: "Skilled Coal Mining" }),
        ],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Deposit Types" });
    await user.click(screen.getByRole("button", { name: "Add deposit type" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create deposit type",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Coal Seam",
    );

    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Job 1 linked job" }),
      JOB_ID,
    );
    await user.click(within(dialog).getByRole("button", { name: "Add job" }));
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Job 2 linked job" }),
      JOB_ID,
    );

    expect(
      within(dialog).getAllByText(
        "This job is already selected in another row above.",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      within(dialog).getByRole("button", { name: "Create" }),
    ).toBeDisabled();
  });

  it("emits a success toast after editing a deposit type", async () => {
    const user = userEvent.setup();
    const depositTypeRow = createDepositTypeRow({
      name: "Iron Ore",
      deposit_type_jobs: [createDepositTypeJobRow({ job_id: JOB_ID })],
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [depositTypeRow],
        fetchedRow: depositTypeRow,
        jobRows: [createJobRow({ id: JOB_ID, name: "Iron Mining" })],
        resourceRows: [],
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

  it("narrows results via the search input", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({ name: "Iron Ore" }),
          createDepositTypeRow({
            id: "00000000-0000-0000-0000-000000000011",
            name: "Coal Seam",
          }),
        ],
        jobRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Iron Ore");
    expect(screen.getByText("Coal Seam")).toBeDefined();

    await user.type(
      screen.getByRole("textbox", { name: "Search deposit types by name" }),
      "Iron",
    );

    await waitFor(() => {
      expect(screen.queryByText("Coal Seam")).toBeNull();
      expect(screen.getByText("Iron Ore")).toBeDefined();
    });
  });

  it("opens a confirm dialog naming the deposit type when delete permanently is clicked", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({ is_trashed: true, name: "Iron Vein" }),
        ],
        jobRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Deposit Types" });
    await user.click(screen.getByRole("button", { name: "Show trash" }));
    await screen.findByText("Iron Vein");
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Permanently delete Iron Vein?",
    });
    expect(dialog).toHaveTextContent(/cannot be undone/i);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("does not call the hard-delete mutation when the confirm dialog is cancelled", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({ is_trashed: true, name: "Iron Vein" }),
        ],
        jobRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Deposit Types" });
    await user.click(screen.getByRole("button", { name: "Show trash" }));
    await screen.findByText("Iron Vein");
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Permanently delete Iron Vein?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("alertdialog", {
          name: "Permanently delete Iron Vein?",
        }),
      ).toBeNull();
    });
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("permanently deletes a deposit type only after the confirm dialog is accepted", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({ is_trashed: true, name: "Iron Vein" }),
        ],
        jobRows: [],
        resourceRows: [],
        rpcResult: {
          data: { id: DEPOSIT_TYPE_ID, world_id: WORLD_ID },
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Deposit Types" });
    await user.click(screen.getByRole("button", { name: "Show trash" }));
    await screen.findByText("Iron Vein");
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Permanently delete Iron Vein?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Delete permanently" }),
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Deposit type permanently deleted.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("restores a trashed deposit type", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({ is_trashed: true, name: "Iron Vein" }),
        ],
        jobRows: [],
        resourceRows: [],
        rpcResult: {
          data: { id: DEPOSIT_TYPE_ID, world_id: WORLD_ID },
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Deposit Types" });
    await user.click(screen.getByRole("button", { name: "Show trash" }));
    await screen.findByText("Iron Vein");
    await user.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Deposit type restored.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("disables the delete permanently button when the deposit type has active references", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        depositTypeRows: [
          createDepositTypeRow({
            is_trashed: true,
            name: "Iron Vein",
            referencing_jobs: [{ id: JOB_ID }],
          }),
        ],
        jobRows: [],
        resourceRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Deposit Types" });
    await user.click(screen.getByRole("button", { name: "Show trash" }));
    await screen.findByText("Iron Vein");

    const deleteBtn = screen.getByRole("button", {
      name: "Delete permanently",
    });
    expect((deleteBtn as HTMLButtonElement).disabled).toBe(true);
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
      <DepositsConfigPanel
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

type TestDepositTypeJobRow = {
  readonly id: string;
  readonly job_id: string;
  readonly tier_number: number;
  readonly output_units_per_worker: number;
  readonly worker_inputs_json: readonly unknown[];
};

type TestDepositTypeRow = {
  readonly created_at: string;
  readonly deposit_type_jobs: readonly TestDepositTypeJobRow[];
  readonly icon: string | null;
  readonly icon_color: number | null;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly name: string;
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

type TestJobRow = {
  readonly base_capacity: number | null;
  readonly created_at: string;
  readonly culling_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly deposit_type_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly husbandry_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly id: string;
  readonly inputs_json: readonly unknown[];
  readonly is_trashed: boolean;
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
  readonly is_trashed: boolean;
  readonly is_system_resource: boolean;
  readonly last_cleanup_summary_json: null;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

function createDepositTypeJobRow(
  overrides: Partial<TestDepositTypeJobRow> = {},
): TestDepositTypeJobRow {
  return {
    id: "00000000-0000-0000-0000-0000000000a1",
    job_id: JOB_ID,
    tier_number: 1,
    output_units_per_worker: 1,
    worker_inputs_json: [],
    ...overrides,
  };
}

function createDepositTypeRow(
  overrides: Partial<TestDepositTypeRow> = {},
): TestDepositTypeRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    deposit_type_jobs: [createDepositTypeJobRow()],
    icon: null,
    icon_color: null,
    id: DEPOSIT_TYPE_ID,
    is_trashed: false,
    name: "Test Deposit",
    referencing_jobs: [],
    slug: "test-deposit",
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createJobRow(overrides: Partial<TestJobRow> = {}): TestJobRow {
  return {
    base_capacity: null,
    created_at: "2026-01-01T00:00:00.000Z",
    culling_mpt: [],
    deposit_type_jobs: [],
    husbandry_mpt: [],
    id: JOB_ID,
    inputs_json: [],
    is_trashed: false,
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
    is_trashed: false,
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
  fetchedRow = createDepositTypeRow(),
  jobRows,
  resourceRows,
  rpcResult = { data: null, error: null },
}: {
  readonly depositTypeRows: readonly TestDepositTypeRow[];
  readonly fetchedRow?: TestDepositTypeRow;
  readonly jobRows: readonly TestJobRow[];
  readonly resourceRows: readonly TestResourceRow[];
  readonly rpcResult?: {
    readonly data: { readonly id: string; readonly world_id: string } | null;
    readonly error: { readonly message: string } | null;
  };
}): {
  readonly from: ReturnType<typeof vi.fn>;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "deposit_types") {
        return createDepositTypesQueryBuilder(depositTypeRows, fetchedRow);
      }
      if (table === "deposit_type_jobs") {
        return createDepositTypeJobsQueryBuilder();
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
  fetchedRow: TestDepositTypeRow,
): unknown {
  // Emulates enough of the real filter/order/range/returns chain that the
  // panel's server-side search + pagination + trash filtering (#1032)
  // behaves like the real Supabase query would. Also emulates the
  // insert/update two-step flow used by depositsMutations.ts (#1246): the
  // deposit_types row is inserted/updated first (returning only `id`), then
  // deposit_type_jobs is replaced separately, then the full row is re-fetched
  // by id for the mutation's return value.
  function buildListBuilder(): Record<string, unknown> {
    let filtered: TestDepositTypeRow[] = [...rows];
    let range: readonly [number, number] | null = null;

    const selectBuilder: Record<string, unknown> = {
      eq: vi.fn((column: string, value: unknown) => {
        filtered = filtered.filter(
          (row) => row[column as keyof TestDepositTypeRow] === value,
        );
        return selectBuilder;
      }),
      ilike: vi.fn((column: string, pattern: string) => {
        const needle = pattern.replaceAll("%", "").toLowerCase();
        filtered = filtered.filter((row) =>
          String(row[column as keyof TestDepositTypeRow] as string)
            .toLowerCase()
            .includes(needle),
        );
        return selectBuilder;
      }),
      order: vi.fn(() => selectBuilder),
      range: vi.fn((start: number, end: number) => {
        range = [start, end];
        return selectBuilder;
      }),
      returns: vi.fn(() => {
        const data =
          range === null ? filtered : filtered.slice(range[0], range[1] + 1);
        return Promise.resolve({ count: filtered.length, data, error: null });
      }),
    };
    return selectBuilder;
  }

  function buildFetchByIdBuilder(): Record<string, unknown> {
    const builder: Record<string, unknown> = {
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn().mockResolvedValue({ data: fetchedRow, error: null }),
    };
    return builder;
  }

  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { id: fetchedRow.id }, error: null }),
      })),
    })),
    select: vi.fn((columns: unknown, opts?: unknown) => {
      if (columns === "id") {
        return buildFetchByIdBuilder();
      }
      if (opts !== undefined) {
        return buildListBuilder();
      }
      return buildFetchByIdBuilder();
    }),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: { id: fetchedRow.id }, error: null }),
          })),
        })),
      })),
    })),
  };
}

function createDepositTypeJobsQueryBuilder(): unknown {
  return {
    delete: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
    insert: vi.fn().mockResolvedValue({ error: null }),
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
