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

    expect(await screen.findByText("No blueprints yet")).toBeDefined();
  });

  it("hides the Add blueprint button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ blueprintRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("No blueprints yet");
    expect(screen.queryByRole("button", { name: "Add blueprint" })).toBeNull();
  });

  it("shows blueprint list with slug", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [
          createBlueprintRow({ name: "Farmhouse", slug: "farmhouse" }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Farmhouse");
    expect(screen.getByText("farmhouse")).toBeDefined();
  });

  it("shows archived blueprints and badge when toggle is active", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [
          createBlueprintRow({ is_active: true, name: "Active Blueprint" }),
          createBlueprintRow({
            id: "00000000-0000-0000-0000-000000000003",
            is_active: false,
            name: "Archived Blueprint",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Active Blueprint");
    expect(screen.queryByText("Archived Blueprint")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show archived" }));

    expect(screen.getByText("Archived Blueprint")).toBeDefined();
    expect(screen.getByText("archived")).toBeDefined();
    expect(screen.getByRole("button", { name: "Hide archived" })).toBeDefined();
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

function createClient({
  blueprintRows,
  insertResult = { data: createBlueprintRow(), error: null },
  updateResult = { data: createBlueprintRow(), error: null },
}: {
  readonly blueprintRows: readonly TestBlueprintRow[];
  readonly insertResult?: {
    readonly data: TestBlueprintRow | null;
    readonly error: { readonly message: string } | null;
  };
  readonly updateResult?: {
    readonly data: TestBlueprintRow | null;
    readonly error: { readonly message: string } | null;
  };
}): {
  readonly from: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "building_blueprints") {
        return createBlueprintsQueryBuilder(
          blueprintRows,
          insertResult,
          updateResult,
        );
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
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
