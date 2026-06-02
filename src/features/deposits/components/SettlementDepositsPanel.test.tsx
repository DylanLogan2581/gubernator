import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettlementDepositsPanel } from "./SettlementDepositsPanel";

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

const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000001";
const WORLD_ID = "00000000-0000-0000-0000-000000000002";
const INSTANCE_ID_1 = "00000000-0000-0000-0000-000000000010";
const INSTANCE_ID_2 = "00000000-0000-0000-0000-000000000011";
const DEPOSIT_TYPE_ID = "00000000-0000-0000-0000-000000000020";
const RESOURCE_ID_1 = "00000000-0000-0000-0000-000000000030";
const RESOURCE_ID_2 = "00000000-0000-0000-0000-000000000031";
const CITIZEN_ID_1 = "00000000-0000-0000-0000-000000000040";
const CITIZEN_ID_2 = "00000000-0000-0000-0000-000000000041";

type TestDepositInstanceRow = {
  readonly id: string;
  readonly settlement_id: string;
  readonly deposit_type_id: string;
  readonly deposit_types: {
    readonly job: { readonly name: string };
    readonly name: string;
  };
  readonly name: string;
  readonly status: string;
  readonly max_workers: number | null;
  readonly discovered_by_event_id: null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deposit_instance_resources: ReadonlyArray<{
    readonly id: string;
    readonly deposit_instance_id: string;
    readonly resource_id: string;
    readonly initial_quantity: number;
    readonly remaining_quantity: number;
    readonly created_at: string;
    readonly updated_at: string;
    readonly resources: { readonly name: string };
  }>;
};

function createInstanceRow(
  overrides: Partial<TestDepositInstanceRow> = {},
): TestDepositInstanceRow {
  return {
    id: INSTANCE_ID_1,
    settlement_id: SETTLEMENT_ID,
    deposit_type_id: DEPOSIT_TYPE_ID,
    deposit_types: { job: { name: "Miner" }, name: "Coal Vein" },
    name: "North Mine",
    status: "active",
    max_workers: 5,
    discovered_by_event_id: null,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    deposit_instance_resources: [
      {
        id: "00000000-0000-0000-0000-000000000050",
        deposit_instance_id: INSTANCE_ID_1,
        resource_id: RESOURCE_ID_1,
        initial_quantity: 100,
        remaining_quantity: 60,
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z",
        resources: { name: "Coal" },
      },
    ],
    ...overrides,
  };
}

type TestAssignmentRow = {
  readonly citizen_id: string;
  readonly assignment_type: string;
  readonly job_id: null;
  readonly construction_project_id: null;
  readonly deposit_instance_id: string | null;
  readonly managed_population_instance_id: null;
  readonly trade_route_id: null;
  readonly trade_route_end: null;
  readonly assigned_on_turn_number: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly citizens: { readonly settlement_id: string };
};

function createAssignmentRow(
  overrides: Partial<TestAssignmentRow> = {},
): TestAssignmentRow {
  return {
    citizen_id: CITIZEN_ID_1,
    assignment_type: "deposit",
    job_id: null,
    construction_project_id: null,
    deposit_instance_id: INSTANCE_ID_1,
    managed_population_instance_id: null,
    trade_route_id: null,
    trade_route_end: null,
    assigned_on_turn_number: 1,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    citizens: { settlement_id: SETTLEMENT_ID },
    ...overrides,
  };
}

type TestDepositTypeRow = {
  readonly id: string;
  readonly world_id: string;
  readonly name: string;
  readonly slug: string;
  readonly is_trashed: boolean;
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly job_id: string | null;
  readonly output_units_per_worker: number;
  readonly worker_inputs_json: unknown[];
  readonly created_at: string;
  readonly updated_at: string;
};

function createDepositTypeRow(
  overrides: Partial<TestDepositTypeRow> = {},
): TestDepositTypeRow {
  return {
    id: DEPOSIT_TYPE_ID,
    world_id: WORLD_ID,
    name: "Coal Vein",
    slug: "coal-vein",
    is_trashed: false,
    referencing_jobs: [],
    job_id: null,
    output_units_per_worker: 1,
    worker_inputs_json: [],
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

type TestResourceRow = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly world_id: string;
  readonly is_trashed: boolean;
};

function createResourceRow(
  overrides: Partial<TestResourceRow> = {},
): TestResourceRow {
  return {
    id: RESOURCE_ID_1,
    name: "Coal",
    slug: "coal",
    world_id: WORLD_ID,
    is_trashed: false,
    ...overrides,
  };
}

function createClient({
  instanceRows = [],
  assignmentRows = [],
  depositTypeRows = [],
  resourceRows = [],
  rpcMock,
}: {
  readonly instanceRows?: readonly TestDepositInstanceRow[];
  readonly assignmentRows?: readonly TestAssignmentRow[];
  readonly depositTypeRows?: readonly TestDepositTypeRow[];
  readonly resourceRows?: readonly TestResourceRow[];
  readonly rpcMock?: ReturnType<typeof vi.fn>;
} = {}): unknown {
  const instancesSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => instancesSelectBuilder),
    order: vi.fn(() => instancesSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: instanceRows, error: null }),
  };

  const assignmentsSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => assignmentsSelectBuilder),
    in: vi.fn(() => assignmentsSelectBuilder),
    order: vi.fn(() => assignmentsSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: assignmentRows, error: null }),
  };

  const depositTypesSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => depositTypesSelectBuilder),
    order: vi.fn(() => depositTypesSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: depositTypeRows, error: null }),
  };

  const resourcesSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => resourcesSelectBuilder),
    order: vi.fn(() => resourcesSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: resourceRows, error: null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "deposit_instances") {
        return { select: vi.fn(() => instancesSelectBuilder) };
      }
      if (table === "citizen_assignments") {
        return { select: vi.fn(() => assignmentsSelectBuilder) };
      }
      if (table === "deposit_types") {
        return { select: vi.fn(() => depositTypesSelectBuilder) };
      }
      if (table === "resources") {
        return { select: vi.fn(() => resourcesSelectBuilder) };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: rpcMock ?? vi.fn(),
  };
}

describe("SettlementDepositsPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("renders grouped by status — active, depleted, removed", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [
          createInstanceRow({
            id: INSTANCE_ID_1,
            name: "North Mine",
            status: "active",
          }),
          createInstanceRow({
            id: INSTANCE_ID_2,
            name: "South Mine",
            status: "depleted",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, canManage: false });

    await screen.findByText("North Mine");
    expect(screen.getByText("South Mine")).toBeDefined();
    expect(screen.getByText("Active (1)")).toBeDefined();
    expect(screen.getByText("Depleted (1)")).toBeDefined();
  });

  it("shows deposit type name and resource remaining/initial in each row", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow()],
      }),
    );

    renderPanel({ canAdmin: false, canManage: false });

    await screen.findByText("North Mine");
    expect(screen.getByText("Coal Vein")).toBeDefined();
    expect(screen.getByText(/Coal: 60\/100/)).toBeDefined();
  });

  it("shows worker count with max-workers cap", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow({ max_workers: 5 })],
        assignmentRows: [
          createAssignmentRow({ citizen_id: CITIZEN_ID_1 }),
          createAssignmentRow({ citizen_id: CITIZEN_ID_2 }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, canManage: false });

    await screen.findByText("North Mine");
    expect(screen.getByText("2/5")).toBeDefined();
  });

  it("shows assigned count without cap when max_workers is null", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow({ max_workers: null })],
        assignmentRows: [createAssignmentRow()],
      }),
    );

    renderPanel({ canAdmin: false, canManage: false });

    await screen.findByText("North Mine");
    expect(screen.getByText("1 assigned")).toBeDefined();
  });

  it("renders empty state when no deposit instances", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ instanceRows: [] }));

    renderPanel({ canAdmin: false, canManage: false });

    expect(await screen.findByText("No deposits")).toBeDefined();
  });

  it("shows add button for admins", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ instanceRows: [] }));

    renderPanel({ canAdmin: true, canManage: false });

    await screen.findByText("No deposits");
    expect(
      screen.getByRole("button", { name: "Add deposit instance" }),
    ).toBeDefined();
  });

  it("hides add button from non-admins", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ instanceRows: [] }));

    renderPanel({ canAdmin: false, canManage: true });

    await screen.findByText("No deposits");
    expect(
      screen.queryByRole("button", { name: "Add deposit instance" }),
    ).toBeNull();
  });

  it("opens add dialog when admin clicks add button", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({ instanceRows: [], depositTypeRows: [], resourceRows: [] }),
    );

    renderPanel({ canAdmin: true, canManage: false });

    await screen.findByText("No deposits");
    await user.click(
      screen.getByRole("button", { name: "Add deposit instance" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Add deposit instance" }),
    ).toBeDefined();
  });

  it("submits add deposit instance form", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "create_deposit_instance") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: INSTANCE_ID_1, settlement_id: SETTLEMENT_ID },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [],
        depositTypeRows: [createDepositTypeRow()],
        resourceRows: [createResourceRow()],
        rpcMock,
      }),
    );

    renderPanel({ canAdmin: true, canManage: false });

    await screen.findByText("No deposits");
    await user.click(
      screen.getByRole("button", { name: "Add deposit instance" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Add deposit instance",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "East Mine",
    );

    const depositTypeSelect = await within(dialog).findByRole("combobox", {
      name: "Deposit type",
    });
    await user.selectOptions(depositTypeSelect, DEPOSIT_TYPE_ID);

    // Add a resource row
    await user.click(
      within(dialog).getByRole("button", { name: "Add resource" }),
    );
    const amountInput = within(dialog).getByRole("textbox", {
      name: /Resources entry 1 initial quantity/i,
    });
    await user.clear(amountInput);
    await user.type(amountInput, "50");

    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "create_deposit_instance",
        expect.objectContaining({
          p_name: "East Mine",
          p_deposit_type_id: DEPOSIT_TYPE_ID,
          p_settlement_id: SETTLEMENT_ID,
        }),
      );
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Deposit instance created.",
        undefined,
      );
    });
  });

  it("shows validation error for duplicate resources in add dialog", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [],
        depositTypeRows: [createDepositTypeRow()],
        resourceRows: [
          createResourceRow(),
          createResourceRow({ id: RESOURCE_ID_2, name: "Iron" }),
        ],
      }),
    );

    renderPanel({ canAdmin: true, canManage: false });

    await screen.findByText("No deposits");
    await user.click(
      screen.getByRole("button", { name: "Add deposit instance" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Add deposit instance",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Mine",
    );
    const depositTypeSelect = await within(dialog).findByRole("combobox", {
      name: "Deposit type",
    });
    await user.selectOptions(depositTypeSelect, DEPOSIT_TYPE_ID);

    // Add two resource entries (they start as Coal and Iron respectively)
    await user.click(
      within(dialog).getByRole("button", { name: "Add resource" }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Add resource" }),
    );

    // Change the second entry's resource to Coal (same as first) to create a duplicate
    const resourceSelect2 = within(dialog).getByRole("combobox", {
      name: "Resources entry 2 resource",
    });
    await user.selectOptions(resourceSelect2, RESOURCE_ID_1);

    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(
      await screen.findByText(/Duplicate resources are not allowed/),
    ).toBeDefined();
  });

  it("disables remove button when deposit has assigned workers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow({ status: "active" })],
        assignmentRows: [createAssignmentRow()],
      }),
    );

    renderPanel({ canAdmin: true, canManage: false });

    await screen.findByText("North Mine");
    const removeButton = screen.getByRole("button", {
      name: "Remove North Mine",
    });
    expect(removeButton).toBeDisabled();
  });

  it("enables remove button when deposit has no assigned workers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow({ status: "active" })],
        assignmentRows: [],
      }),
    );

    renderPanel({ canAdmin: true, canManage: false });

    await screen.findByText("North Mine");
    const removeButton = screen.getByRole("button", {
      name: "Remove North Mine",
    });
    expect(removeButton).not.toBeDisabled();
  });

  it("calls remove RPC and shows success toast on confirm", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "remove_deposit_instance") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: INSTANCE_ID_1, settlement_id: SETTLEMENT_ID },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow()],
        assignmentRows: [],
        rpcMock,
      }),
    );

    renderPanel({ canAdmin: true, canManage: false });

    await screen.findByText("North Mine");
    await user.click(screen.getByRole("button", { name: "Remove North Mine" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Remove North Mine?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("remove_deposit_instance", {
        p_deposit_instance_id: INSTANCE_ID_1,
      });
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "North Mine removed.",
        undefined,
      );
    });
  });

  it("shows max workers edit button for managers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow()],
      }),
    );

    renderPanel({ canAdmin: false, canManage: true });

    await screen.findByText("North Mine");
    expect(
      screen.getByRole("button", { name: "Edit max workers for North Mine" }),
    ).toBeDefined();
  });

  it("max-workers raise succeeds without confirmation dialog", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "set_deposit_instance_max_workers") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: { max_workers: 10, unassigned_citizen_ids: [] },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow({ max_workers: 5 })],
        assignmentRows: [createAssignmentRow()],
        rpcMock,
      }),
    );

    renderPanel({ canAdmin: true, canManage: true });

    await screen.findByText("North Mine");
    await user.click(
      screen.getByRole("button", { name: "Edit max workers for North Mine" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: /Edit max workers/,
    });
    const maxWorkersInput = within(dialog).getByRole("textbox", {
      name: "Max workers",
    });
    await user.clear(maxWorkersInput);
    await user.type(maxWorkersInput, "10");

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "set_deposit_instance_max_workers",
        expect.objectContaining({
          p_max_workers: 10,
          p_removal_strategy: null,
        }),
      );
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Max workers updated.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("max-workers shrink opens confirmation dialog showing cascade count and strategy picker", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow({ max_workers: 5 })],
        assignmentRows: [
          createAssignmentRow({ citizen_id: CITIZEN_ID_1 }),
          createAssignmentRow({ citizen_id: CITIZEN_ID_2 }),
        ],
      }),
    );

    renderPanel({ canAdmin: true, canManage: true });

    await screen.findByText("North Mine");
    await user.click(
      screen.getByRole("button", { name: "Edit max workers for North Mine" }),
    );

    const editDialog = await screen.findByRole("dialog", {
      name: /Edit max workers/,
    });
    const maxWorkersInput = within(editDialog).getByRole("textbox", {
      name: "Max workers",
    });
    await user.clear(maxWorkersInput);
    await user.type(maxWorkersInput, "1");
    await user.click(within(editDialog).getByRole("button", { name: "Save" }));

    // Should now show the shrink confirmation dialog
    const confirmDialog = await screen.findByRole("dialog", {
      name: "Unassign workers?",
    });
    expect(within(confirmDialog).getByText(/cascade-unassign/)).toBeDefined();
    expect(
      within(confirmDialog).getByRole("combobox", { name: "Removal strategy" }),
    ).toBeDefined();
  });

  it("cascade-unassign result is surfaced via toast", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "set_deposit_instance_max_workers") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              max_workers: 1,
              unassigned_citizen_ids: [CITIZEN_ID_1, CITIZEN_ID_2],
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow({ max_workers: 5 })],
        assignmentRows: [
          createAssignmentRow({ citizen_id: CITIZEN_ID_1 }),
          createAssignmentRow({ citizen_id: CITIZEN_ID_2 }),
        ],
        rpcMock,
      }),
    );

    renderPanel({ canAdmin: true, canManage: true });

    await screen.findByText("North Mine");
    await user.click(
      screen.getByRole("button", { name: "Edit max workers for North Mine" }),
    );

    const editDialog = await screen.findByRole("dialog", {
      name: /Edit max workers/,
    });
    const maxWorkersInput = within(editDialog).getByRole("textbox", {
      name: "Max workers",
    });
    await user.clear(maxWorkersInput);
    await user.type(maxWorkersInput, "1");
    await user.click(within(editDialog).getByRole("button", { name: "Save" }));

    const confirmDialog = await screen.findByRole("dialog", {
      name: "Unassign workers?",
    });
    await user.click(
      within(confirmDialog).getByRole("button", { name: "Confirm" }),
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Max workers updated. 2 citizens were unassigned.",
        undefined,
      );
    });
  });
});

function renderPanel({
  canAdmin,
  canManage,
  isArchived = false,
}: {
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly isArchived?: boolean;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SettlementDepositsPanel
        canAdmin={canAdmin}
        canManage={canManage}
        isArchived={isArchived}
        settlementId={SETTLEMENT_ID}
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
