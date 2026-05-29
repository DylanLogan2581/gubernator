import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorldResourcesConfigPanel } from "./WorldResourcesConfigPanel";

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

describe("WorldResourcesConfigPanel", () => {
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

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Gold");
    await user.clear(screen.getByRole("textbox", { name: "Slug" }));
    await user.type(screen.getByRole("textbox", { name: "Slug" }), "gold");

    await user.click(screen.getByRole("button", { name: "Create" }));

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
    await user.click(screen.getByRole("button", { name: "Create" }));

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

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Gold");
    await user.type(
      screen.getByRole("textbox", { name: "Base stockpile cap" }),
      "not-a-number",
    );

    await user.click(screen.getByRole("button", { name: "Create" }));

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
      <WorldResourcesConfigPanel
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
  readonly is_deleted: boolean;
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
    is_deleted: false,
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
}: {
  readonly insertResult?: {
    readonly data: TestResourceRow | null;
    readonly error: { readonly message: string } | null;
  };
  readonly resourceRows: readonly TestResourceRow[];
}): {
  readonly from: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "resources") {
        return createResourcesQueryBuilder(resourceRows, insertResult);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createResourcesQueryBuilder(
  rows: readonly TestResourceRow[],
  insertResult: {
    readonly data: TestResourceRow | null;
    readonly error: { readonly message: string } | null;
  },
): unknown {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue(insertResult),
      })),
    })),
    select: vi.fn(() => selectBuilder),
  };
}
