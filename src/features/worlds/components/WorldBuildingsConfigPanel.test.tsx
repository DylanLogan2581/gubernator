import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorldBuildingsConfigPanel } from "./WorldBuildingsConfigPanel";

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

describe("WorldBuildingsConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("shows empty state when there are no blueprints", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ blueprintRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText("No buildings yet")).toBeDefined();
  });

  it("hides the Add blueprint button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ blueprintRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("No buildings yet");
    expect(screen.queryByRole("button", { name: "Add blueprint" })).toBeNull();
  });

  it("shows blueprint list", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [
          createBlueprintRow({ name: "Farmhouse", slug: "farmhouse" }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Farmhouse");
    expect(screen.queryByText("farmhouse")).toBeNull();
  });

  it("shows trashed blueprints when trash view is toggled", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [
          createBlueprintRow({ is_active: true, name: "Active Blueprint" }),
          createBlueprintRow({
            id: "00000000-0000-0000-0000-000000000003",
            is_active: false,
            name: "Trashed Blueprint",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Active Blueprint");
    expect(screen.queryByText("Trashed Blueprint")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show trash" }));

    expect(screen.getByText("Trashed Blueprint")).toBeDefined();
    expect(screen.getByRole("button", { name: "Hide trash" })).toBeDefined();
  });

  it("emits a success toast after creating a blueprint", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [],
        insertResult: {
          data: createBlueprintRow({ name: "Farmhouse" }),
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Buildings" });
    await user.click(screen.getByRole("button", { name: "Add blueprint" }));

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Farmhouse");
    await user.clear(screen.getByRole("textbox", { name: "Slug" }));
    await user.type(screen.getByRole("textbox", { name: "Slug" }), "farmhouse");

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Blueprint created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("emits a success toast after editing a blueprint", async () => {
    const user = userEvent.setup();
    const blueprintRow = createBlueprintRow({ name: "Farmhouse" });
    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [blueprintRow],
        updateResult: {
          data: blueprintRow,
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Farmhouse");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit blueprint" });
    const nameInput = screen.getByRole("textbox", { name: "Name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Farmhouse");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Blueprint saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("hides the Edit button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [createBlueprintRow({ name: "Farmhouse" })],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Farmhouse");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("moves a blueprint to trash via the inline row button", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [createBlueprintRow({ name: "Farmhouse" })],
        rpcResult: {
          data: { id: BLUEPRINT_ID, world_id: WORLD_ID },
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Farmhouse");
    await user.click(
      screen.getByRole("button", { name: "Move Farmhouse to trash" }),
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Blueprint moved to trash.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("hides the inline trash button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [createBlueprintRow({ name: "Farmhouse" })],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Farmhouse");
    expect(
      screen.queryByRole("button", { name: "Move Farmhouse to trash" }),
    ).toBeNull();
  });

  // ── InlineTierDraftForm nested-form regression ───────────────────────────

  it("clicking Add on tier draft adds draft to pending list without submitting the blueprint form", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [],
        resourceRows: [],
        jobRows: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Buildings" });
    await user.click(screen.getByRole("button", { name: "Add blueprint" }));

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Farmhouse");
    await user.clear(screen.getByRole("textbox", { name: "Slug" }));
    await user.type(screen.getByRole("textbox", { name: "Slug" }), "farmhouse");

    await user.click(screen.getByRole("button", { name: "Add tier" }));

    await screen.findByText("New tier");

    const tierNumberInput = screen.getByRole("textbox", {
      name: "Tier number",
    });
    await user.clear(tierNumberInput);
    await user.type(tierNumberInput, "1");

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText(/Tier 1/)).toBeDefined();
    expect(screen.queryByText("New tier")).toBeNull();

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("clicking Add on tier draft does not submit the outer blueprint form", async () => {
    const user = userEvent.setup();
    const insertSpy = vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: createBlueprintRow(), error: null }),
      })),
    }));
    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [],
        resourceRows: [],
        jobRows: [],
        blueprintInsertSpy: insertSpy,
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Buildings" });
    await user.click(screen.getByRole("button", { name: "Add blueprint" }));

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Farmhouse");
    await user.clear(screen.getByRole("textbox", { name: "Slug" }));
    await user.type(screen.getByRole("textbox", { name: "Slug" }), "farmhouse");

    await user.click(screen.getByRole("button", { name: "Add tier" }));

    await screen.findByText("New tier");

    const tierNumberInput = screen.getByRole("textbox", {
      name: "Tier number",
    });
    await user.clear(tierNumberInput);
    await user.type(tierNumberInput, "1");

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText(/Tier 1/)).toBeDefined();

    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("creates a blueprint with a pending tier after clicking Add then Create", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [],
        resourceRows: [],
        jobRows: [],
        insertResult: {
          data: createBlueprintRow({ name: "Farmhouse" }),
          error: null,
        },
        tierInsertResult: {
          data: createTierRow(),
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Buildings" });
    await user.click(screen.getByRole("button", { name: "Add blueprint" }));

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Farmhouse");
    await user.clear(screen.getByRole("textbox", { name: "Slug" }));
    await user.type(screen.getByRole("textbox", { name: "Slug" }), "farmhouse");

    await user.click(screen.getByRole("button", { name: "Add tier" }));

    await screen.findByText("New tier");

    const tierNumberInput = screen.getByRole("textbox", {
      name: "Tier number",
    });
    await user.clear(tierNumberInput);
    await user.type(tierNumberInput, "1");

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText(/Tier 1/)).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Blueprint and tiers created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
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
      <WorldBuildingsConfigPanel
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

type TestTierRow = {
  readonly building_blueprint_id: string;
  readonly construction_costs_json: readonly unknown[];
  readonly created_at: string;
  readonly effects_json: readonly unknown[];
  readonly id: string;
  readonly tier_number: number;
  readonly updated_at: string;
  readonly upkeep_costs_json: readonly unknown[];
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
  readonly culling_mpt: readonly unknown[];
  readonly deposit_types: readonly unknown[];
  readonly husbandry_mpt: readonly unknown[];
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
    name: "Test Blueprint",
    slug: "test-blueprint",
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
    id: "00000000-0000-0000-0000-000000000010",
    tier_number: 1,
    updated_at: "2026-01-01T00:00:00.000Z",
    upkeep_costs_json: [],
    worker_turns_required: 0,
    ...overrides,
  };
}

function createClient({
  blueprintInsertSpy,
  blueprintRows,
  insertResult = { data: createBlueprintRow(), error: null },
  jobRows = [],
  resourceRows = [],
  rpcResult = { data: null, error: null },
  tierInsertResult = { data: createTierRow(), error: null },
  updateResult = { data: createBlueprintRow(), error: null },
}: {
  readonly blueprintInsertSpy?: ReturnType<typeof vi.fn>;
  readonly blueprintRows: readonly TestBlueprintRow[];
  readonly insertResult?: {
    readonly data: TestBlueprintRow | null;
    readonly error: { readonly message: string } | null;
  };
  readonly jobRows?: readonly TestJobRow[];
  readonly resourceRows?: readonly TestResourceRow[];
  readonly rpcResult?: {
    readonly data: { readonly id: string; readonly world_id: string } | null;
    readonly error: { readonly message: string } | null;
  };
  readonly tierInsertResult?: {
    readonly data: TestTierRow | null;
    readonly error: { readonly message: string } | null;
  };
  readonly updateResult?: {
    readonly data: TestBlueprintRow | null;
    readonly error: { readonly message: string } | null;
  };
}): {
  readonly from: ReturnType<typeof vi.fn>;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "building_blueprints") {
        return createBlueprintsQueryBuilder(
          blueprintRows,
          insertResult,
          updateResult,
          blueprintInsertSpy,
        );
      }
      if (table === "building_blueprint_tiers") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue(tierInsertResult),
            })),
          })),
        };
      }
      if (table === "resources") {
        return createSimpleQueryBuilder(resourceRows);
      }
      if (table === "job_definitions") {
        return createSimpleQueryBuilder(jobRows);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue(rpcResult),
    })),
  };
}

function createBlueprintsQueryBuilder(
  rows: readonly TestBlueprintRow[],
  insertResult: {
    readonly data: TestBlueprintRow | null;
    readonly error: { readonly message: string } | null;
  },
  updateResult: {
    readonly data: TestBlueprintRow | null;
    readonly error: { readonly message: string } | null;
  },
  insertSpy?: ReturnType<typeof vi.fn>,
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

  const defaultInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue(insertResult),
    })),
  }));

  return {
    insert: insertSpy ?? defaultInsert,
    select: vi.fn(() => selectBuilder),
    update: vi.fn(() => updateBuilder),
  };
}

function createSimpleQueryBuilder(rows: readonly unknown[]): unknown {
  const builder: Record<string, unknown> = {
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
    select: vi.fn(() => builder),
  };
  return builder;
}
