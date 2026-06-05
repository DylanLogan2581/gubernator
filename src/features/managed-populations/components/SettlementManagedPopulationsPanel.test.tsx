import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettlementManagedPopulationsPanel } from "./SettlementManagedPopulationsPanel";

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
const TYPE_ID_1 = "00000000-0000-0000-0000-000000000020";
const RESOURCE_ID_1 = "00000000-0000-0000-0000-000000000030";
const CITIZEN_ID_1 = "00000000-0000-0000-0000-000000000040";
const JOB_ID_1 = "00000000-0000-0000-0000-000000000050";
const JOB_ID_2 = "00000000-0000-0000-0000-000000000051";
const TRANSITION_ID = "00000000-0000-0000-0000-000000000099";

type TestInstanceRow = {
  readonly id: string;
  readonly settlement_id: string;
  readonly managed_population_type_id: string;
  readonly managed_population_types: {
    readonly name: string;
    readonly husbandry_job: { readonly name: string };
    readonly culling_job: { readonly name: string };
  };
  readonly name: string;
  readonly current_count: number;
  readonly configured_cull_quantity: number;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
};

function createInstanceRow(
  overrides: Partial<TestInstanceRow> = {},
): TestInstanceRow {
  return {
    id: INSTANCE_ID_1,
    settlement_id: SETTLEMENT_ID,
    managed_population_type_id: TYPE_ID_1,
    managed_population_types: {
      name: "Cattle",
      husbandry_job: { name: "Cattle Herder" },
      culling_job: { name: "Butcher" },
    },
    name: "North Herd",
    current_count: 100,
    configured_cull_quantity: 10,
    status: "active",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

type TestTypeRow = {
  readonly id: string;
  readonly world_id: string;
  readonly name: string;
  readonly slug: string;
  readonly husbandry_job_id: string;
  readonly culling_job_id: string;
  readonly husbandry_workers_per_n_animals: number;
  readonly growth_rate: number;
  readonly maintenance_rules_json: unknown[];
  readonly culling_outputs_json: unknown[];
  readonly is_trashed: boolean;
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly created_at: string;
  readonly updated_at: string;
};

function createTypeRow(overrides: Partial<TestTypeRow> = {}): TestTypeRow {
  return {
    id: TYPE_ID_1,
    world_id: WORLD_ID,
    name: "Cattle",
    slug: "cattle",
    husbandry_job_id: JOB_ID_1,
    culling_job_id: JOB_ID_2,
    husbandry_workers_per_n_animals: 10,
    growth_rate: 0.05,
    maintenance_rules_json: [],
    culling_outputs_json: [],
    is_trashed: false,
    referencing_jobs: [],
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
  readonly is_system_resource: boolean;
  readonly base_stockpile_cap: number;
  readonly created_at: string;
  readonly updated_at: string;
};

function createResourceRow(
  overrides: Partial<TestResourceRow> = {},
): TestResourceRow {
  return {
    id: RESOURCE_ID_1,
    name: "Grain",
    slug: "grain",
    world_id: WORLD_ID,
    is_trashed: false,
    is_system_resource: false,
    base_stockpile_cap: 100,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

type TestTransitionRow = {
  readonly id: string;
  readonly world_id: string;
  readonly status: string;
  readonly from_turn_number: number;
  readonly to_turn_number: number;
  readonly started_at: string;
  readonly finished_at: string | null;
  readonly turn_log_entries: ReadonlyArray<{
    readonly id: string;
    readonly world_id: string;
    readonly log_category: string;
    readonly payload_jsonb: unknown;
    readonly citizen_id: string | null;
    readonly nation_id: string | null;
    readonly resource_id: string | null;
    readonly settlement_id: string | null;
  }>;
  readonly notifications: readonly unknown[];
  readonly settlement_turn_snapshots: readonly unknown[];
  readonly settlement_turn_resource_snapshots: readonly unknown[];
};

function createTransitionRow(
  overrides: Partial<TestTransitionRow> = {},
): TestTransitionRow {
  return {
    id: TRANSITION_ID,
    world_id: WORLD_ID,
    status: "completed",
    from_turn_number: 4,
    to_turn_number: 5,
    started_at: "2026-05-05T00:00:00.000Z",
    finished_at: "2026-05-05T00:01:00.000Z",
    turn_log_entries: [],
    notifications: [],
    settlement_turn_snapshots: [],
    settlement_turn_resource_snapshots: [],
    ...overrides,
  };
}

type TestAssignmentRow = {
  readonly citizen_id: string;
  readonly assignment_type: string;
  readonly job: null;
  readonly construction_project: null;
  readonly deposit_instance: null;
  readonly managed_population_instance: {
    readonly id: string;
    readonly name: string;
    readonly managed_population_types: {
      readonly husbandry_job: { readonly name: string };
      readonly culling_job: { readonly name: string };
    };
  } | null;
  readonly trade_route: null;
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
    assignment_type: "husbandry",
    job: null,
    construction_project: null,
    deposit_instance: null,
    managed_population_instance: {
      id: INSTANCE_ID_1,
      name: "North Herd",
      managed_population_types: {
        husbandry_job: { name: "Cattle Herder" },
        culling_job: { name: "Butcher" },
      },
    },
    trade_route: null,
    trade_route_end: null,
    assigned_on_turn_number: 1,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    citizens: { settlement_id: SETTLEMENT_ID },
    ...overrides,
  };
}

type TestSnapshotRow = {
  readonly turn_number: number;
  readonly managed_populations_summary_json: unknown;
};

function createClient({
  instanceRows = [],
  instancesMock,
  typeRows = [],
  resourceRows = [],
  assignmentRows = [],
  transitionRow = null,
  snapshotRows = [],
  rpcMock,
}: {
  readonly instanceRows?: readonly TestInstanceRow[];
  readonly instancesMock?: ReturnType<typeof vi.fn>;
  readonly typeRows?: readonly TestTypeRow[];
  readonly resourceRows?: readonly TestResourceRow[];
  readonly assignmentRows?: readonly TestAssignmentRow[];
  readonly transitionRow?: TestTransitionRow | null;
  readonly snapshotRows?: readonly TestSnapshotRow[];
  readonly rpcMock?: ReturnType<typeof vi.fn>;
} = {}): unknown {
  const instancesSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => instancesSelectBuilder),
    order: vi.fn(() => instancesSelectBuilder),
    returns:
      instancesMock ??
      vi.fn().mockResolvedValue({ data: instanceRows, error: null }),
  };

  const typesSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => typesSelectBuilder),
    order: vi.fn(() => typesSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: typeRows, error: null }),
  };

  const resourcesSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => resourcesSelectBuilder),
    order: vi.fn(() => resourcesSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: resourceRows, error: null }),
  };

  const assignmentsSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => assignmentsSelectBuilder),
    in: vi.fn(() => assignmentsSelectBuilder),
    order: vi.fn(() => assignmentsSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: assignmentRows, error: null }),
  };

  // settlement_turn_snapshots: handles both the latestOutcome lookup (maybeSingle)
  // and the snapshot trend query (returns).
  const snapshotBuilder: Record<string, unknown> = {
    eq: vi.fn(() => snapshotBuilder),
    not: vi.fn(() => snapshotBuilder),
    order: vi.fn(() => snapshotBuilder),
    limit: vi.fn(() => snapshotBuilder),
    maybeSingle: vi.fn().mockResolvedValue({
      data:
        transitionRow !== null ? { turn_transition_id: TRANSITION_ID } : null,
      error: null,
    }),
    returns: vi.fn().mockResolvedValue({ data: snapshotRows, error: null }),
  };

  const transitionSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => transitionSelectBuilder),
    returns: vi.fn(() => transitionSelectBuilder),
    maybeSingle: vi.fn().mockResolvedValue({
      data: transitionRow ?? null,
      error: null,
    }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "managed_population_instances") {
        return { select: vi.fn(() => instancesSelectBuilder) };
      }
      if (table === "managed_population_types") {
        return { select: vi.fn(() => typesSelectBuilder) };
      }
      if (table === "resources") {
        return { select: vi.fn(() => resourcesSelectBuilder) };
      }
      if (table === "citizen_assignments") {
        return { select: vi.fn(() => assignmentsSelectBuilder) };
      }
      if (table === "settlement_turn_snapshots") {
        return { select: vi.fn(() => snapshotBuilder) };
      }
      if (table === "turn_transitions") {
        return { select: vi.fn(() => transitionSelectBuilder) };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: rpcMock ?? vi.fn(),
  };
}

describe("SettlementManagedPopulationsPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("shows only active instances by default — extinct hidden", async () => {
    const user = userEvent.setup();

    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [
          createInstanceRow({
            id: INSTANCE_ID_1,
            name: "North Herd",
            status: "active",
          }),
          createInstanceRow({
            id: INSTANCE_ID_2,
            name: "South Herd",
            status: "extinct",
            current_count: 0,
          }),
        ],
        typeRows: [createTypeRow()],
      }),
    );

    renderPanel({ canAdmin: false, canManage: false });

    await screen.findByText("North Herd");
    expect(screen.queryByText("South Herd")).toBeNull();

    // toggling to extinct view hides active and reveals extinct
    await user.click(screen.getByRole("button", { name: "Show extinct" }));
    expect(await screen.findByText("South Herd")).toBeDefined();
    expect(screen.queryByText("North Herd")).toBeNull();
  });

  it("renders empty state when no instances", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ instanceRows: [] }));

    renderPanel({ canAdmin: false, canManage: false });

    expect(await screen.findByText("No managed populations")).toBeDefined();
  });

  it("shows add button for admins after data loads", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ instanceRows: [] }));

    renderPanel({ canAdmin: true, canManage: false });

    await screen.findByText("No managed populations");
    expect(
      screen.getByRole("button", { name: "Add managed population" }),
    ).toBeDefined();
  });

  it("hides add button from non-admins", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ instanceRows: [] }));

    renderPanel({ canAdmin: false, canManage: true });

    await screen.findByText("No managed populations");
    expect(
      screen.queryByRole("button", { name: "Add managed population" }),
    ).toBeNull();
  });

  it("shows cull edit button for managers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow()],
        typeRows: [createTypeRow()],
      }),
    );

    renderPanel({ canAdmin: false, canManage: true });

    await screen.findByText("North Herd");
    expect(
      screen.getByRole("button", { name: "Edit cull quantity for North Herd" }),
    ).toBeDefined();
  });

  it("hides cull edit button from viewers (non-manage, non-admin)", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow()],
        typeRows: [createTypeRow()],
      }),
    );

    renderPanel({ canAdmin: false, canManage: false });

    await screen.findByText("North Herd");
    expect(
      screen.queryByRole("button", {
        name: "Edit cull quantity for North Herd",
      }),
    ).toBeNull();
  });

  it("cull edit happy path — saves and shows success toast", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "set_configured_cull_quantity") {
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
        instanceRows: [createInstanceRow({ configured_cull_quantity: 10 })],
        typeRows: [createTypeRow()],
        rpcMock,
      }),
    );

    renderPanel({ canAdmin: false, canManage: true });

    await screen.findByText("North Herd");
    await user.click(
      screen.getByRole("button", { name: "Edit cull quantity for North Herd" }),
    );

    const input = screen.getByRole("spinbutton", {
      name: /Cull quantity for North Herd/i,
    });
    await user.clear(input);
    await user.type(input, "20");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "set_configured_cull_quantity",
        expect.objectContaining({
          p_instance_id: INSTANCE_ID_1,
          p_quantity: 20,
        }),
      );
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Cull quantity updated.",
        undefined,
      );
    });
  });

  it("cull > current count is rejected inline without calling mutation", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn();

    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow({ current_count: 100 })],
        typeRows: [createTypeRow()],
        rpcMock,
      }),
    );

    renderPanel({ canAdmin: false, canManage: true });

    await screen.findByText("North Herd");
    await user.click(
      screen.getByRole("button", { name: "Edit cull quantity for North Herd" }),
    );

    const input = screen.getByRole("spinbutton", {
      name: /Cull quantity for North Herd/i,
    });
    await user.clear(input);
    await user.type(input, "150");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(/cannot exceed current count/i),
    ).toBeDefined();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("cull < 0 is rejected inline without calling mutation", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn();

    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow()],
        typeRows: [createTypeRow()],
        rpcMock,
      }),
    );

    renderPanel({ canAdmin: false, canManage: true });

    await screen.findByText("North Herd");
    await user.click(
      screen.getByRole("button", { name: "Edit cull quantity for North Herd" }),
    );

    const input = screen.getByRole("spinbutton", {
      name: /Cull quantity for North Herd/i,
    });
    await user.clear(input);
    await user.type(input, "-5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/at least 0/i)).toBeDefined();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("add-instance flow opens dialog and submits successfully", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "create_managed_population_instance") {
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
        typeRows: [createTypeRow()],
        rpcMock,
      }),
    );

    renderPanel({ canAdmin: true, canManage: false });

    await screen.findByText("No managed populations");
    await user.click(
      screen.getByRole("button", { name: "Add managed population" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Add managed population",
    });

    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "West Herd",
    );

    const typeSelect = await within(dialog).findByRole("combobox", {
      name: "Population type",
    });
    await user.selectOptions(typeSelect, TYPE_ID_1);

    const countInput = within(dialog).getByRole("spinbutton", {
      name: "Initial count",
    });
    await user.clear(countInput);
    await user.type(countInput, "50");

    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "create_managed_population_instance",
        expect.objectContaining({
          p_name: "West Herd",
          p_type_id: TYPE_ID_1,
          p_settlement_id: SETTLEMENT_ID,
          p_initial_count: 50,
        }),
      );
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Managed population created.",
        undefined,
      );
    });
  });

  it("new instance appears in panel immediately after successful create without reload", async () => {
    const user = userEvent.setup();
    const newRow = createInstanceRow({
      id: INSTANCE_ID_1,
      name: "West Herd",
      status: "active",
      current_count: 50,
    });

    const rpcMock = vi.fn((fn: string) => {
      if (fn === "create_managed_population_instance") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: INSTANCE_ID_1, settlement_id: SETTLEMENT_ID },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    // First call (initial load): empty list. Subsequent calls (after invalidation): new row.
    const instancesMock = vi
      .fn()
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValue({ data: [newRow], error: null });

    requireSupabaseClient.mockReturnValue(
      createClient({
        instancesMock,
        typeRows: [createTypeRow()],
        rpcMock,
      }),
    );

    renderPanel({ canAdmin: true, canManage: false });

    await screen.findByText("No managed populations");
    await user.click(
      screen.getByRole("button", { name: "Add managed population" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Add managed population",
    });

    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "West Herd",
    );
    const typeSelect = await within(dialog).findByRole("combobox", {
      name: "Population type",
    });
    await user.selectOptions(typeSelect, TYPE_ID_1);

    const countInput = within(dialog).getByRole("spinbutton", {
      name: "Initial count",
    });
    await user.clear(countInput);
    await user.type(countInput, "50");

    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    // The new row should appear without a manual reload.
    expect(await screen.findByText("West Herd")).toBeDefined();
    // The empty state should be gone.
    expect(screen.queryByText("No managed populations")).toBeNull();
  });

  it("remove blocked when active husbandry assignments exist (button disabled)", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow({ status: "active" })],
        typeRows: [createTypeRow()],
        assignmentRows: [createAssignmentRow()],
      }),
    );

    renderPanel({ canAdmin: true, canManage: false });

    await screen.findByText("North Herd");
    const markExtinctButton = screen.getByRole("button", {
      name: "Mark North Herd extinct",
    });
    expect(markExtinctButton).toBeDisabled();
  });

  it("mark extinct enabled when no active husbandry assignments", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow({ status: "active" })],
        typeRows: [createTypeRow()],
        assignmentRows: [],
      }),
    );

    renderPanel({ canAdmin: true, canManage: false });

    await screen.findByText("North Herd");
    const markExtinctButton = screen.getByRole("button", {
      name: "Mark North Herd extinct",
    });
    expect(markExtinctButton).not.toBeDisabled();
  });

  it("calls remove RPC and shows success toast on confirm", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "remove_managed_population_instance") {
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
        typeRows: [createTypeRow()],
        assignmentRows: [],
        rpcMock,
      }),
    );

    renderPanel({ canAdmin: true, canManage: false });

    await screen.findByText("North Herd");
    await user.click(
      screen.getByRole("button", { name: "Mark North Herd extinct" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Mark North Herd extinct?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Mark extinct" }),
    );

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "remove_managed_population_instance",
        expect.objectContaining({
          p_instance_id: INSTANCE_ID_1,
        }),
      );
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "North Herd marked extinct.",
        undefined,
      );
    });
  });

  it("shows Extinct badge for instances with status=extinct", async () => {
    const user = userEvent.setup();

    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [
          createInstanceRow({
            id: INSTANCE_ID_1,
            name: "South Herd",
            status: "extinct",
            current_count: 0,
          }),
        ],
        typeRows: [createTypeRow()],
      }),
    );

    renderPanel({ canAdmin: false, canManage: false });

    // extinct instances are hidden by default — toggle to reveal
    await screen.findByText("No managed populations");
    await user.click(screen.getByRole("button", { name: "Show extinct" }));

    await screen.findByText("South Herd");
    expect(screen.getByRole("generic", { name: "Extinct" })).toBeDefined();
  });

  it("shows Extinct badge with turn tooltip when managed_population.extinct log entry exists", async () => {
    const user = userEvent.setup();

    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [
          createInstanceRow({
            id: INSTANCE_ID_1,
            name: "South Herd",
            status: "extinct",
            current_count: 0,
          }),
        ],
        typeRows: [createTypeRow()],
        transitionRow: createTransitionRow({
          to_turn_number: 5,
          turn_log_entries: [
            {
              id: "00000000-0000-0000-0000-000000000090",
              world_id: WORLD_ID,
              log_category: "managed_population.extinct",
              payload_jsonb: {
                managedPopulationInstanceId: INSTANCE_ID_1,
                name: "South Herd",
              },
              citizen_id: null,
              nation_id: null,
              resource_id: null,
              settlement_id: SETTLEMENT_ID,
            },
          ],
        }),
      }),
    );

    renderPanel({ canAdmin: false, canManage: false });

    // extinct instances are hidden by default — toggle to reveal
    await screen.findByText("No managed populations");
    await user.click(screen.getByRole("button", { name: "Show extinct" }));

    await screen.findByText("South Herd");
    await waitFor(() => {
      const badge = screen.getByRole("generic", { name: "Extinct" });
      expect(badge.getAttribute("title")).toBe("Turn 5");
    });
  });

  it("shows snapshot-based growth trend when two snapshots are available", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [
          createInstanceRow({
            id: INSTANCE_ID_1,
            name: "North Herd",
            status: "active",
            current_count: 110,
          }),
        ],
        typeRows: [createTypeRow()],
        snapshotRows: [
          {
            turn_number: 5,
            managed_populations_summary_json: [
              { instanceId: INSTANCE_ID_1, currentCount: 110 },
            ],
          },
          {
            turn_number: 4,
            managed_populations_summary_json: [
              { instanceId: INSTANCE_ID_1, currentCount: 100 },
            ],
          },
        ],
      }),
    );

    renderPanel({ canAdmin: false, canManage: false });

    await screen.findByText("North Herd");
    // delta = (110-100)/100*100 = 10%, growing
    expect(screen.getByLabelText("Growing")).toBeDefined();
    expect(screen.getByText(/10\.0%/)).toBeDefined();
  });

  it("shows snapshot-based decline trend when count dropped", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [
          createInstanceRow({
            id: INSTANCE_ID_1,
            name: "North Herd",
            status: "active",
            current_count: 90,
          }),
        ],
        typeRows: [createTypeRow()],
        snapshotRows: [
          {
            turn_number: 5,
            managed_populations_summary_json: [
              { instanceId: INSTANCE_ID_1, currentCount: 90 },
            ],
          },
          {
            turn_number: 4,
            managed_populations_summary_json: [
              { instanceId: INSTANCE_ID_1, currentCount: 100 },
            ],
          },
        ],
      }),
    );

    renderPanel({ canAdmin: false, canManage: false });

    await screen.findByText("North Herd");
    // delta = (90-100)/100*100 = -10%, declining
    expect(screen.getByLabelText("Declining")).toBeDefined();
    expect(screen.getByText(/10\.0%/)).toBeDefined();
  });

  it("shows maintenance per turn using resource names and computed amounts", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [
          createInstanceRow({
            current_count: 100,
            managed_population_type_id: TYPE_ID_1,
          }),
        ],
        typeRows: [
          createTypeRow({
            maintenance_rules_json: [
              { resource_id: RESOURCE_ID_1, amount_per_n_animals: 0.5 },
            ],
          }),
        ],
        resourceRows: [createResourceRow({ id: RESOURCE_ID_1, name: "Grain" })],
      }),
    );

    renderPanel({ canAdmin: false, canManage: false });

    await screen.findByText("North Herd");
    // 100 animals * 0.5 amountPerNAnimals = 50.0
    expect(screen.getByText(/Grain: 50\.0/)).toBeDefined();
  });

  it("shows husbandry job name and worker count", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [
          createInstanceRow({
            current_count: 50,
            managed_population_type_id: TYPE_ID_1,
          }),
        ],
        typeRows: [createTypeRow({ husbandry_workers_per_n_animals: 10 })],
        assignmentRows: [createAssignmentRow()],
      }),
    );

    renderPanel({ canAdmin: false, canManage: false });

    await screen.findByText("North Herd");
    expect(screen.getByText("Cattle Herder")).toBeDefined();
    // required = ceil(50/10) = 5, assigned = 1
    expect(screen.getByText("(1/5)")).toBeDefined();
  });

  it("mark extinct button is not shown for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        instanceRows: [createInstanceRow({ status: "active" })],
        typeRows: [createTypeRow()],
      }),
    );

    renderPanel({ canAdmin: false, canManage: true });

    await screen.findByText("North Herd");
    expect(
      screen.queryByRole("button", { name: "Mark North Herd extinct" }),
    ).toBeNull();
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
      <SettlementManagedPopulationsPanel
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
