import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NamesetsConfigPanel } from "./NamesetsConfigPanel";

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
const NAMESET_ID = "00000000-0000-0000-0000-000000000002";
const NAMESET_ID_2 = "00000000-0000-0000-0000-000000000003";

describe("NamesetsConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("shows empty state when there are no namesets", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ namesetRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText("No namesets yet")).toBeDefined();
  });

  it("hides the Add nameset button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ namesetRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("No namesets yet");
    expect(screen.queryByRole("button", { name: "Add nameset" })).toBeNull();
  });

  it("shows namesets with type and name-pool counts in the table", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        namesetRows: [
          createNamesetRow({
            name: "Norse",
            config_json: {
              convention: "patronymic",
              male_given_names: ["Bjorn", "Erik"],
              female_given_names: ["Astrid"],
              surnames: ["Ironside"],
            },
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Norse");
    const row = screen.getByText("Norse").closest("tr");
    expect(row).toHaveTextContent("Patronymic");
    expect(row).toHaveTextContent("3");
    expect(row).toHaveTextContent("1");
  });

  it("narrows results via the search input", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        namesetRows: [
          createNamesetRow({ name: "Norse" }),
          createNamesetRow({ id: NAMESET_ID_2, name: "Latin" }),
        ],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Norse");
    expect(screen.getByText("Latin")).toBeDefined();

    await user.type(
      screen.getByRole("textbox", { name: "Search namesets by name" }),
      "Nor",
    );

    await waitFor(() => {
      expect(screen.queryByText("Latin")).toBeNull();
      expect(screen.getByText("Norse")).toBeDefined();
    });
  });

  it("sorts by a column when its header is clicked", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        namesetRows: [
          createNamesetRow({ name: "Norse" }),
          createNamesetRow({ id: NAMESET_ID_2, name: "Latin" }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Norse");
    await user.click(screen.getByRole("button", { name: "Name" }));

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Latin")).toBeDefined();
    expect(within(rows[1]).getByText("Norse")).toBeDefined();
  });

  it("hides the Edit button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ namesetRows: [createNamesetRow({ name: "Norse" })] }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Norse");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("emits a success toast after editing a nameset", async () => {
    const user = userEvent.setup();
    const namesetRow = createNamesetRow({ name: "Norse" });
    requireSupabaseClient.mockReturnValue(
      createClient({
        namesetRows: [namesetRow],
        updateResult: { data: namesetRow, error: null },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Norse");
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await screen.findByRole("heading", { name: "Edit nameset" });
    const nameInput = screen.getByRole("textbox", { name: "Name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Norse Clans");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Nameset saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("moves a nameset to trash via the inline row button", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        namesetRows: [createNamesetRow({ is_default: false, name: "Norse" })],
        rpcResult: {
          data: { id: NAMESET_ID, world_id: WORLD_ID },
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Norse");
    await user.click(
      screen.getByRole("button", { name: "Move Norse to trash" }),
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Nameset moved to trash.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("sets a nameset as world default via the star button", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        namesetRows: [createNamesetRow({ is_default: false, name: "Norse" })],
        rpcResult: {
          data: { id: NAMESET_ID, world_id: WORLD_ID },
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Norse");
    await user.click(
      screen.getByRole("button", { name: "Set Norse as world default" }),
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Default nameset updated.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows trashed namesets when trash view is toggled", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        namesetRows: [
          createNamesetRow({ is_trashed: false, name: "Active Nameset" }),
          createNamesetRow({
            id: NAMESET_ID_2,
            is_trashed: true,
            name: "Trashed Nameset",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Active Nameset");
    expect(screen.queryByText("Trashed Nameset")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show trash" }));

    expect(screen.getByText("Trashed Nameset")).toBeDefined();
    expect(screen.getByRole("button", { name: "Hide trash" })).toBeDefined();
  });

  it("restores a trashed nameset", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        namesetRows: [
          createNamesetRow({ is_trashed: true, name: "Trashed Nameset" }),
        ],
        rpcResult: {
          data: { id: NAMESET_ID, world_id: WORLD_ID },
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Namesets" });
    await user.click(screen.getByRole("button", { name: "Show trash" }));
    await screen.findByText("Trashed Nameset");
    await user.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Nameset restored.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("permanently deletes a trashed nameset", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        namesetRows: [
          createNamesetRow({ is_trashed: true, name: "Trashed Nameset" }),
        ],
        rpcResult: {
          data: { id: NAMESET_ID, world_id: WORLD_ID },
          error: null,
        },
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Namesets" });
    await user.click(screen.getByRole("button", { name: "Show trash" }));
    await screen.findByText("Trashed Nameset");
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Nameset permanently deleted.",
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
      <NamesetsConfigPanel
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

type TestNamesetConfigJson = {
  readonly convention: string;
  readonly female_given_names: readonly string[];
  readonly male_given_names: readonly string[];
  readonly surnames: readonly string[];
};

type TestNamesetRow = {
  readonly config_json: TestNamesetConfigJson;
  readonly created_at: string;
  readonly id: string;
  readonly is_default: boolean;
  readonly is_trashed: boolean;
  readonly name: string;
  readonly updated_at: string;
  readonly world_id: string;
};

function createNamesetRow(
  overrides: Partial<TestNamesetRow> = {},
): TestNamesetRow {
  return {
    config_json: {
      convention: "pool",
      female_given_names: [],
      male_given_names: [],
      surnames: [],
    },
    created_at: "2026-01-01T00:00:00.000Z",
    id: NAMESET_ID,
    is_default: false,
    is_trashed: false,
    name: "Test Nameset",
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createClient({
  namesetRows,
  insertResult = { data: createNamesetRow(), error: null },
  rpcResult = { data: null, error: null },
  updateResult = { data: createNamesetRow(), error: null },
}: {
  readonly namesetRows: readonly TestNamesetRow[];
  readonly insertResult?: {
    readonly data: TestNamesetRow | null;
    readonly error: { readonly message: string } | null;
  };
  readonly rpcResult?: {
    readonly data: { readonly id: string; readonly world_id: string } | null;
    readonly error: { readonly message: string } | null;
  };
  readonly updateResult?: {
    readonly data: TestNamesetRow | null;
    readonly error: { readonly message: string } | null;
  };
}): {
  readonly from: ReturnType<typeof vi.fn>;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "namesets") {
        return createNamesetsQueryBuilder(
          namesetRows,
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

function createNamesetsQueryBuilder(
  rows: readonly TestNamesetRow[],
  insertResult: {
    readonly data: TestNamesetRow | null;
    readonly error: { readonly message: string } | null;
  },
  updateResult: {
    readonly data: TestNamesetRow | null;
    readonly error: { readonly message: string } | null;
  },
): unknown {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn(() => Promise.resolve({ data: rows, error: null })),
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
