import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BlueprintTierEditor } from "./BlueprintTierEditor";

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

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <a className={className}>{children}</a>,
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const BLUEPRINT_ID = "00000000-0000-0000-0000-000000000002";
const TIER_ID = "00000000-0000-0000-0000-000000000003";
const RESOURCE_ID = "00000000-0000-0000-0000-000000000004";
const JOB_ID = "00000000-0000-0000-0000-000000000005";
const DELETED_RESOURCE_ID = "00000000-0000-0000-0000-000000000006";
const INACTIVE_JOB_ID = "00000000-0000-0000-0000-000000000007";

describe("BlueprintTierEditor", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("shows empty state when the blueprint has no tiers", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ tierRows: [] }));

    renderEditor({ canAdmin: true, isArchived: false });

    expect(await screen.findByText("No tiers yet")).toBeDefined();
  });

  it("shows tier list ordered by tier number", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        tierRows: [
          createTierRow({ tier_number: 2 }),
          createTierRow({
            id: "00000000-0000-0000-0000-000000000010",
            tier_number: 1,
          }),
        ],
      }),
    );

    renderEditor({ canAdmin: false, isArchived: false });

    const items = await screen.findAllByText(/Tier \d/);
    expect(items[0].textContent).toBe("Tier 1");
    expect(items[1].textContent).toBe("Tier 2");
  });

  it("hides the Add tier button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ tierRows: [] }));

    renderEditor({ canAdmin: false, isArchived: false });

    await screen.findByText("No tiers yet");
    expect(screen.queryByRole("button", { name: "Add tier" })).toBeNull();
  });

  it("creates a tier with population_cap_increase effect (happy path)", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        tierRows: [],
        tierInsertResult: {
          data: createTierRow({
            effects_json: [{ amount: 50, type: "population_cap_increase" }],
          }),
          error: null,
        },
      }),
    );

    renderEditor({ canAdmin: true, isArchived: false });

    await screen.findByText("No tiers yet");
    await user.click(screen.getByRole("button", { name: "Add tier" }));

    await screen.findByRole("heading", { name: "New tier" });
    const tierNumberInput = screen.getByPlaceholderText("1");
    await user.clear(tierNumberInput);
    await user.type(tierNumberInput, "1");

    await user.click(screen.getByRole("button", { name: "Add effect" }));

    const effectTypePicker = screen.getByRole("combobox", {
      name: "Effect type",
    });
    await user.selectOptions(effectTypePicker, "population_cap_increase");

    const amountInput = screen.getByRole("textbox", { name: "Effect amount" });
    await user.clear(amountInput);
    await user.type(amountInput, "50");

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Tier created.", undefined);
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("creates a tier with job_capacity_increase effect (happy path)", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        tierRows: [],
        tierInsertResult: {
          data: createTierRow({
            effects_json: [
              {
                amount: 5,
                job_id: JOB_ID,
                type: "job_capacity_increase",
              },
            ],
          }),
          error: null,
        },
      }),
    );

    renderEditor({ canAdmin: true, isArchived: false });

    await screen.findByText("No tiers yet");
    await user.click(screen.getByRole("button", { name: "Add tier" }));

    await screen.findByRole("heading", { name: "New tier" });
    await user.click(screen.getByRole("button", { name: "Add effect" }));

    const effectTypePicker = screen.getByRole("combobox", {
      name: "Effect type",
    });
    await user.selectOptions(effectTypePicker, "job_capacity_increase");

    const jobPicker = await screen.findByRole("combobox", { name: "Job" });
    await user.selectOptions(jobPicker, JOB_ID);

    const amountInput = screen.getByRole("textbox", { name: "Effect amount" });
    await user.type(amountInput, "5");

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Tier created.", undefined);
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("creates a tier with passive_resource_production effect (happy path)", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        tierRows: [],
        tierInsertResult: {
          data: createTierRow({
            effects_json: [
              {
                amount: 3,
                resource_id: RESOURCE_ID,
                type: "passive_resource_production",
              },
            ],
          }),
          error: null,
        },
      }),
    );

    renderEditor({ canAdmin: true, isArchived: false });

    await screen.findByText("No tiers yet");
    await user.click(screen.getByRole("button", { name: "Add tier" }));

    await screen.findByRole("heading", { name: "New tier" });
    await user.click(screen.getByRole("button", { name: "Add effect" }));

    const effectTypePicker = screen.getByRole("combobox", {
      name: "Effect type",
    });
    await user.selectOptions(effectTypePicker, "passive_resource_production");

    const resourcePicker = await screen.findByRole("combobox", {
      name: "Effect resource",
    });
    await user.selectOptions(resourcePicker, RESOURCE_ID);

    const amountInput = screen.getByRole("textbox", { name: "Effect amount" });
    await user.type(amountInput, "3");

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Tier created.", undefined);
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("creates a tier with resource_storage_increase effect (happy path)", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        tierRows: [],
        tierInsertResult: {
          data: createTierRow({
            effects_json: [
              {
                amount: 100,
                resource_id: RESOURCE_ID,
                type: "resource_storage_increase",
              },
            ],
          }),
          error: null,
        },
      }),
    );

    renderEditor({ canAdmin: true, isArchived: false });

    await screen.findByText("No tiers yet");
    await user.click(screen.getByRole("button", { name: "Add tier" }));

    await screen.findByRole("heading", { name: "New tier" });
    await user.click(screen.getByRole("button", { name: "Add effect" }));

    const effectTypePicker = screen.getByRole("combobox", {
      name: "Effect type",
    });
    await user.selectOptions(effectTypePicker, "resource_storage_increase");

    const resourcePicker = await screen.findByRole("combobox", {
      name: "Effect resource",
    });
    await user.selectOptions(resourcePicker, RESOURCE_ID);

    const amountInput = screen.getByRole("textbox", { name: "Effect amount" });
    await user.type(amountInput, "100");

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Tier created.", undefined);
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows inline error when construction cost references a soft-deleted resource", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        tierRows: [
          createTierRow({
            construction_costs_json: [
              { amount: 10, resource_id: DELETED_RESOURCE_ID },
            ],
          }),
        ],
      }),
    );

    renderEditor({ canAdmin: true, isArchived: false });

    await screen.findByText("Tier 1");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit tier 1" });
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          `Resource ${DELETED_RESOURCE_ID} is not an active resource in this world.`,
        ),
      ).toBeDefined();
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows inline error when effect references an inactive job", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        tierRows: [
          createTierRow({
            effects_json: [
              {
                amount: 5,
                job_id: INACTIVE_JOB_ID,
                type: "job_capacity_increase",
              },
            ],
          }),
        ],
      }),
    );

    renderEditor({ canAdmin: true, isArchived: false });

    await screen.findByText("Tier 1");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit tier 1" });
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          `Job ${INACTIVE_JOB_ID} is not an active job in this world.`,
        ),
      ).toBeDefined();
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("emits a success toast after saving a tier", async () => {
    const user = userEvent.setup();
    const tierRow = createTierRow();
    requireSupabaseClient.mockReturnValue(
      createClient({
        tierRows: [tierRow],
        tierUpdateResult: { data: tierRow, error: null },
      }),
    );

    renderEditor({ canAdmin: true, isArchived: false });

    await screen.findByText("Tier 1");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit tier 1" });
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Tier saved.", undefined);
    });
    expect(toastError).not.toHaveBeenCalled();
  });
});

function renderEditor({
  canAdmin,
  isArchived,
}: {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <BlueprintTierEditor
        blueprintId={BLUEPRINT_ID}
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

// ─── Row fixtures ───────────────────────────────────────────────────────────

type TestBlueprintRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly grace_period_turns: number;
  readonly id: string;
  readonly is_active: boolean;
  readonly max_instances_per_settlement: number | null;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

type TestCostRow = { readonly amount: number; readonly resource_id: string };

type TestEffectRow =
  | { readonly amount: number; readonly type: "population_cap_increase" }
  | {
      readonly amount: number;
      readonly job_id: string;
      readonly type: "job_capacity_increase";
    }
  | {
      readonly amount: number;
      readonly resource_id: string;
      readonly type: "passive_resource_production";
    }
  | {
      readonly amount: number;
      readonly resource_id: string;
      readonly type: "resource_storage_increase";
    };

type TestTierRow = {
  readonly building_blueprint_id: string;
  readonly construction_costs_json: readonly TestCostRow[];
  readonly created_at: string;
  readonly effects_json: readonly TestEffectRow[];
  readonly id: string;
  readonly tier_number: number;
  readonly updated_at: string;
  readonly upkeep_costs_json: readonly TestCostRow[];
  readonly worker_turns_required: number;
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

type TestJobRow = {
  readonly base_capacity: number | null;
  readonly created_at: string;
  readonly culling_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly deposit_types: ReadonlyArray<{ readonly id: string }>;
  readonly husbandry_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly id: string;
  readonly inputs_json: readonly never[];
  readonly is_active: boolean;
  readonly job_type: string;
  readonly linked_deposit_type_id: string | null;
  readonly linked_managed_population_type_id: string | null;
  readonly name: string;
  readonly outputs_json: readonly never[];
  readonly slug: string;
  readonly trader_capacity_per_worker: number | null;
  readonly updated_at: string;
  readonly world_id: string;
};

function createBlueprintRow(
  overrides: Partial<TestBlueprintRow> = {},
): TestBlueprintRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    description: null,
    grace_period_turns: 0,
    id: BLUEPRINT_ID,
    is_active: true,
    max_instances_per_settlement: null,
    name: "Farmhouse",
    slug: "farmhouse",
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createTierRow(overrides: Partial<TestTierRow> = {}): TestTierRow {
  return {
    building_blueprint_id: BLUEPRINT_ID,
    construction_costs_json: [],
    created_at: "2026-01-01T00:00:00.000Z",
    effects_json: [],
    id: TIER_ID,
    tier_number: 1,
    updated_at: "2026-01-01T00:00:00.000Z",
    upkeep_costs_json: [],
    worker_turns_required: 0,
    ...overrides,
  };
}

function createResourceRow(
  overrides: Partial<TestResourceRow> = {},
): TestResourceRow {
  return {
    base_stockpile_cap: 100,
    created_at: "2026-01-01T00:00:00.000Z",
    id: RESOURCE_ID,
    is_deleted: false,
    is_system_resource: false,
    last_cleanup_summary_json: null,
    name: "Wood",
    slug: "wood",
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
    deposit_types: [],
    husbandry_mpt: [],
    id: JOB_ID,
    inputs_json: [],
    is_active: true,
    job_type: "standard",
    linked_deposit_type_id: null,
    linked_managed_population_type_id: null,
    name: "Farming",
    outputs_json: [],
    slug: "farming",
    trader_capacity_per_worker: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

// ─── Mock client ────────────────────────────────────────────────────────────

function createClient({
  blueprintRow = createBlueprintRow(),
  tierRows = [],
  resourceRows = [createResourceRow()],
  jobRows = [createJobRow()],
  tierInsertResult = {
    data: createTierRow(),
    error: null,
  },
  tierUpdateResult = {
    data: createTierRow(),
    error: null,
  },
  tierDeleteResult = {
    data: { building_blueprint_id: BLUEPRINT_ID, id: TIER_ID },
    error: null,
  },
}: {
  readonly blueprintRow?: TestBlueprintRow | null;
  readonly jobRows?: readonly TestJobRow[];
  readonly resourceRows?: readonly TestResourceRow[];
  readonly tierDeleteResult?: {
    readonly data: {
      readonly building_blueprint_id: string;
      readonly id: string;
    } | null;
    readonly error: { readonly message: string } | null;
  };
  readonly tierInsertResult?: {
    readonly data: TestTierRow | null;
    readonly error: { readonly message: string } | null;
  };
  readonly tierRows?: readonly TestTierRow[];
  readonly tierUpdateResult?: {
    readonly data: TestTierRow | null;
    readonly error: { readonly message: string } | null;
  };
}): { readonly from: ReturnType<typeof vi.fn> } {
  return {
    from: vi.fn((table: string) => {
      if (table === "building_blueprints") {
        return createBlueprintTableBuilder(blueprintRow);
      }
      if (table === "building_blueprint_tiers") {
        return createTierTableBuilder(
          tierRows,
          tierInsertResult,
          tierUpdateResult,
          tierDeleteResult,
        );
      }
      if (table === "resources") {
        return createListTableBuilder(resourceRows);
      }
      if (table === "job_definitions") {
        return createListTableBuilder(jobRows);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createBlueprintTableBuilder(
  blueprintRow: TestBlueprintRow | null,
): unknown {
  const builder: Record<string, unknown> = {};
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: blueprintRow, error: null });
  builder.returns = vi.fn().mockResolvedValue({
    data: blueprintRow !== null ? [blueprintRow] : [],
    error: null,
  });
  return { select: vi.fn(() => builder) };
}

function createTierTableBuilder(
  rows: readonly TestTierRow[],
  insertResult: {
    readonly data: TestTierRow | null;
    readonly error: { readonly message: string } | null;
  },
  updateResult: {
    readonly data: TestTierRow | null;
    readonly error: { readonly message: string } | null;
  },
  deleteResult: {
    readonly data: {
      readonly building_blueprint_id: string;
      readonly id: string;
    } | null;
    readonly error: { readonly message: string } | null;
  },
): unknown {
  const readBuilder: Record<string, unknown> = {};
  readBuilder.eq = vi.fn(() => readBuilder);
  readBuilder.order = vi.fn(() => readBuilder);
  readBuilder.returns = vi.fn().mockResolvedValue({ data: rows, error: null });

  return {
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue(deleteResult),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue(insertResult),
      })),
    })),
    select: vi.fn(() => readBuilder),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue(updateResult),
        })),
      })),
    })),
  };
}

function createListTableBuilder(rows: readonly unknown[]): unknown {
  const builder: Record<string, unknown> = {};
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.returns = vi.fn().mockResolvedValue({ data: rows, error: null });
  return { select: vi.fn(() => builder) };
}
