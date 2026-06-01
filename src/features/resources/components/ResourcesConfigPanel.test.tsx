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

function createResourceRow(
  overrides: Partial<TestResourceRow> = {},
): TestResourceRow {
  return {
    base_stockpile_cap: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    id: RESOURCE_ID,
    is_trashed: false,
    is_system_resource: false,
    last_cleanup_summary_json: null,
    name: "Food",
    slug: "food",
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createClient({
  insertResult = { data: createResourceRow(), error: null },
  resourceRows,
  rpcResult = { data: null, error: null },
  updateResult = { data: createResourceRow(), error: null },
}: {
  readonly insertResult?: {
    readonly data: TestResourceRow | null;
    readonly error: { readonly message: string } | null;
  };
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
      if (table === "resources") {
        return createResourcesQueryBuilder(
          resourceRows,
          insertResult,
          updateResult,
        );
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue(rpcResult),
    })),
  };
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
