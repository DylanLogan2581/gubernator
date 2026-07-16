import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResourcesConfigPanel } from "./ResourcesConfigPanel";

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
const RESOURCE_ID = "00000000-0000-0000-0000-000000000002";

describe("ResourcesConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("emits a success toast after creating a resource", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({ resourceRows: [] }));

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Resources" });
    await user.click(screen.getByRole("button", { name: "Add resource" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create resource",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Gold",
    );

    expect(within(dialog).getByText("slug: gold")).toBeDefined();

    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Resource created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows inline validation errors when required fields are empty", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({ resourceRows: [] }));

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Resources" });
    await user.click(screen.getByRole("button", { name: "Add resource" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create resource",
    });
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Resource name is required.")).toBeDefined();
    expect(screen.getByText("Resource slug is required.")).toBeDefined();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("shows inline validation error for an invalid base stockpile cap", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({ resourceRows: [] }));

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Resources" });
    await user.click(screen.getByRole("button", { name: "Add resource" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create resource",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Gold",
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: "Base stockpile cap" }),
      "not-a-number",
    );

    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(
      await screen.findByText(
        "Base stockpile cap must be a non-negative decimal with up to four decimal places.",
      ),
    ).toBeDefined();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("flags a percent decay below -100% as the user types, before submit", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({ resourceRows: [] }));

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Resources" });
    await user.click(screen.getByRole("button", { name: "Add resource" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create resource",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Change amount" }),
      "-150",
    );

    expect(
      within(dialog).getByText("Percent decay cannot exceed 100% per turn."),
    ).toBeDefined();
    expect(
      within(dialog).queryByText(/Decreases by 150% each turn\./),
    ).toBeNull();
  });

  it("shows a system badge for system resources", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        resourceRows: [createResourceRow({ is_system_resource: true })],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    expect(screen.getByText("system")).toBeDefined();
  });

  it("shows empty state when there are no resources", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ resourceRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText("No resources yet")).toBeDefined();
  });

  it("hides the Add resource button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ resourceRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("No resources yet");
    expect(screen.queryByRole("button", { name: "Add resource" })).toBeNull();
  });

  it("saves updated resource name", async () => {
    const user = userEvent.setup();
    const resourceRow = createResourceRow({
      is_system_resource: false,
      name: "Gold",
      slug: "gold",
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        resourceRows: [resourceRow],
        updateResult: {
          data: { ...resourceRow, name: "Silver" },
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Gold");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit resource" });
    const nameInput = screen.getByRole("textbox", { name: "Name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Silver");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Resource saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows the Move to trash button as disabled for system resources in the edit form", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        resourceRows: [createResourceRow({ is_system_resource: true })],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Food");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit resource" });
    const trashBtn = screen.getByRole("button", { name: "Move to trash" });
    expect(trashBtn).toBeDefined();
    expect((trashBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("moves a non-system resource to trash via the edit form", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        resourceRows: [
          createResourceRow({ is_system_resource: false, name: "Gold" }),
        ],
        rpcResult: {
          data: { id: RESOURCE_ID, world_id: WORLD_ID },
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Gold");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit resource" });
    await user.click(screen.getByRole("button", { name: "Move to trash" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Resource moved to trash.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("moves a non-system resource to trash via the inline row button", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        resourceRows: [
          createResourceRow({ is_system_resource: false, name: "Gold" }),
        ],
        rpcResult: {
          data: { id: RESOURCE_ID, world_id: WORLD_ID },
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Gold");
    await user.click(
      screen.getByRole("button", { name: "Move Gold to trash" }),
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Resource moved to trash.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("hides the inline trash button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        resourceRows: [
          createResourceRow({ is_system_resource: false, name: "Gold" }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Gold");
    expect(
      screen.queryByRole("button", { name: "Move Gold to trash" }),
    ).toBeNull();
  });

  it("shows the inline trash button as disabled for system resources", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        resourceRows: [
          createResourceRow({ is_system_resource: true, name: "Food" }),
        ],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Food");
    const trashBtn = screen.getByRole("button", {
      name: "Food is a system resource and cannot be deleted",
    });
    expect(trashBtn).toBeDefined();
    expect((trashBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows trashed resources when trash view is toggled", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        resourceRows: [
          createResourceRow({ is_trashed: false, name: "Active Resource" }),
          createResourceRow({
            id: "00000000-0000-0000-0000-000000000010",
            is_trashed: true,
            name: "Trashed Resource",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Active Resource");
    expect(screen.queryByText("Trashed Resource")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show trash" }));

    expect(screen.getByText("Trashed Resource")).toBeDefined();
    expect(screen.getByRole("button", { name: "Hide trash" })).toBeDefined();
  });

  it("narrows results via the search input", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        resourceRows: [
          createResourceRow({ name: "Gold" }),
          createResourceRow({
            id: "00000000-0000-0000-0000-000000000011",
            name: "Silver",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Gold");
    expect(screen.getByText("Silver")).toBeDefined();

    await user.type(
      screen.getByRole("textbox", { name: "Search resources by name" }),
      "Gol",
    );

    await waitFor(() => {
      expect(screen.queryByText("Silver")).toBeNull();
      expect(screen.getByText("Gold")).toBeDefined();
    });
  });

  it("shows a filter-specific empty state, not the pristine empty state, when a category filter matches nothing", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        categoryRows: [
          createResourceCategoryRow({
            id: "00000000-0000-0000-0000-000000000020",
            name: "Metals",
          }),
        ],
        resourceRows: [createResourceRow({ name: "Gold" })],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Gold");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by category" }),
      "Metals",
    );

    expect(await screen.findByText("No matching resources")).toBeDefined();
    expect(screen.queryByText("No resources yet")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(await screen.findByText("Gold")).toBeDefined();
  });

  it("filters to resources with no category via the Uncategorized option", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        categoryRows: [
          createResourceCategoryRow({
            id: "00000000-0000-0000-0000-000000000020",
            name: "Metals",
          }),
        ],
        resourceRows: [
          createResourceRow({ category_id: null, name: "Gold" }),
          createResourceRow({
            category_id: "00000000-0000-0000-0000-000000000020",
            id: "00000000-0000-0000-0000-000000000011",
            name: "Iron",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Gold");
    expect(screen.getByText("Iron")).toBeDefined();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by category" }),
      "Uncategorized",
    );

    await waitFor(() => {
      expect(screen.queryByText("Iron")).toBeNull();
      expect(screen.getByText("Gold")).toBeDefined();
    });
  });

  it("hides the manage categories dialog's own title so the panel heading isn't duplicated", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({ resourceRows: [] }));

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("No resources yet");
    await user.click(screen.getByRole("button", { name: "Manage categories" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Manage resource categories",
    });
    const dialogTitle = within(dialog).getByText("Manage resource categories");
    expect(dialogTitle.closest('[data-slot="dialog-header"]')).toHaveClass(
      "sr-only",
    );
    expect(
      within(dialog).getByRole("heading", { name: "Resource categories" }),
    ).toBeDefined();
  });

  it("re-fetches with server-side order when a sortable column header is clicked", async () => {
    const orderSpy = vi.fn();
    requireSupabaseClient.mockReturnValue(
      createClient({
        orderSpy,
        resourceRows: [createResourceRow({ name: "Gold" })],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Gold");
    orderSpy.mockClear();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Storage cap/ }));

    await waitFor(() => {
      expect(orderSpy).toHaveBeenCalledWith("base_stockpile_cap", {
        ascending: true,
      });
    });
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
      <ResourcesConfigPanel
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

type TestResourceRow = {
  readonly base_stockpile_cap: number;
  readonly category_id: string | null;
  readonly created_at: string;
  readonly change_amount: number;
  readonly change_mode: "percent" | "flat";
  readonly icon: string | null;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly is_system_resource: boolean;
  readonly last_cleanup_summary_json: null;
  readonly name: string;
  readonly resource_categories: null;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

function createResourceRow(
  overrides: Partial<TestResourceRow> = {},
): TestResourceRow {
  return {
    base_stockpile_cap: 0,
    category_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    change_amount: 0,
    change_mode: "percent",
    icon: null,
    id: RESOURCE_ID,
    is_trashed: false,
    is_system_resource: false,
    last_cleanup_summary_json: null,
    name: "Food",
    resource_categories: null,
    slug: "food",
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

type TestResourceCategoryRow = {
  readonly color: string;
  readonly created_at: string;
  readonly id: string;
  readonly name: string;
  readonly sort_order: number;
  readonly updated_at: string;
  readonly world_id: string;
};

function createResourceCategoryRow(
  overrides: Partial<TestResourceCategoryRow> = {},
): TestResourceCategoryRow {
  return {
    color: "#6b7280",
    created_at: "2026-01-01T00:00:00.000Z",
    id: "00000000-0000-0000-0000-000000000020",
    name: "Metals",
    sort_order: 0,
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createClient({
  categoryRows = [],
  insertResult = { data: createResourceRow(), error: null },
  orderSpy,
  resourceRows,
  rpcResult = { data: null, error: null },
  updateResult = { data: createResourceRow(), error: null },
}: {
  readonly categoryRows?: readonly TestResourceCategoryRow[];
  readonly insertResult?: {
    readonly data: TestResourceRow | null;
    readonly error: { readonly message: string } | null;
  };
  readonly orderSpy?: (...args: unknown[]) => void;
  readonly resourceRows: readonly TestResourceRow[];
  readonly rpcResult?: {
    readonly data: { readonly id: string; readonly world_id: string } | null;
    readonly error: { readonly message: string } | null;
  };
  readonly updateResult?: {
    readonly data: TestResourceRow | null;
    readonly error: { readonly message: string } | null;
  };
}): {
  readonly from: ReturnType<typeof vi.fn>;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "resources_directory_view") {
        return {
          select: vi.fn(() =>
            buildSelectBuilder(
              resourceRows.map((row) => toDirectoryRow(row, categoryRows)),
              orderSpy,
            ),
          ),
        };
      }
      if (table === "resources") {
        return createResourcesQueryBuilder(
          resourceRows,
          insertResult,
          updateResult,
        );
      }
      if (table === "resource_categories") {
        return createResourceCategoriesQueryBuilder(categoryRows);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue(rpcResult),
    })),
  };
}

type TestResourceDirectoryRow = Omit<TestResourceRow, "resource_categories"> & {
  readonly category_color: string | null;
  readonly category_name: string | null;
};

function toDirectoryRow(
  row: TestResourceRow,
  categoryRows: readonly TestResourceCategoryRow[],
): TestResourceDirectoryRow {
  const { resource_categories: _resourceCategories, ...rest } = row;
  const category = categoryRows.find((c) => c.id === row.category_id) ?? null;
  return {
    ...rest,
    category_color: category?.color ?? null,
    category_name: category?.name ?? null,
  };
}

function buildSelectBuilder<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  orderSpy?: (...args: unknown[]) => void,
): Record<string, unknown> {
  // Emulates enough of the real filter/order/range/returns chain that the
  // panel's server-side search + pagination + trash filtering (#1032)
  // behaves like the real Supabase query would, instead of always
  // returning every row regardless of the applied filters.
  let filtered: TRow[] = [...rows];
  let range: readonly [number, number] | null = null;

  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn((column: string, value: unknown) => {
      filtered = filtered.filter((row) => row[column] === value);
      return selectBuilder;
    }),
    is: vi.fn((column: string, value: unknown) => {
      filtered = filtered.filter((row) => row[column] === value);
      return selectBuilder;
    }),
    ilike: vi.fn((column: string, pattern: string) => {
      const needle = pattern.replaceAll("%", "").toLowerCase();
      filtered = filtered.filter((row) =>
        String(row[column]).toLowerCase().includes(needle),
      );
      return selectBuilder;
    }),
    order: vi.fn((...args: unknown[]) => {
      orderSpy?.(...args);
      return selectBuilder;
    }),
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

function createResourceCategoriesQueryBuilder(
  categoryRows: readonly TestResourceCategoryRow[] = [],
): Record<string, unknown> {
  const builder: Record<string, unknown> = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue({ data: categoryRows, error: null }),
  };
  return { select: vi.fn(() => builder) };
}

function createResourcesQueryBuilder(
  rows: readonly TestResourceRow[],
  insertResult: {
    readonly data: TestResourceRow | null;
    readonly error: { readonly message: string } | null;
  },
  updateResult: {
    readonly data: TestResourceRow | null;
    readonly error: { readonly message: string } | null;
  },
): unknown {
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
    select: vi.fn(() => buildSelectBuilder(rows)),
    update: vi.fn(() => updateBuilder),
  };
}
