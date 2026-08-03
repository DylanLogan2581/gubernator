import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReligionsConfigPanel } from "./ReligionsConfigPanel";

import type { ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
  }: {
    readonly children?: ReactNode;
    readonly params: {
      readonly religionId: string;
      readonly worldId: string;
    };
  }) => (
    <a
      href={`/worlds/${params.worldId}/configuration/religions/${params.religionId}`}
    >
      {children}
    </a>
  ),
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
const RELIGION_ID = "00000000-0000-0000-0000-000000000002";

describe("ReligionsConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("emits a success toast after creating a religion", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({ religionRows: [] }));

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Religions" });
    await user.click(screen.getByRole("button", { name: "Add religion" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create religion",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Sun Cult",
    );

    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Religion created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows inline validation error when name is empty", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({ religionRows: [] }));

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Religions" });
    await user.click(screen.getByRole("button", { name: "Add religion" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create religion",
    });
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Religion name is required.")).toBeDefined();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("shows empty state when there are no religions", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ religionRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText("No religions yet")).toBeDefined();
  });

  it("hides the Add religion button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ religionRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("No religions yet");
    expect(screen.queryByRole("button", { name: "Add religion" })).toBeNull();
  });

  it("lists existing religions", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        religionRows: [createReligionRow({ name: "Sun Cult" })],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText("Sun Cult")).toBeDefined();
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
      <ReligionsConfigPanel
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

type TestReligionRow = {
  readonly color: string;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly updated_at: string;
  readonly world_id: string;
};

function createReligionRow(
  overrides: Partial<TestReligionRow> = {},
): TestReligionRow {
  return {
    color: "#6b7280",
    created_at: "2026-01-01T00:00:00.000Z",
    description: null,
    id: RELIGION_ID,
    name: "Sun Cult",
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createClient({
  religionRows,
  insertResult = { data: createReligionRow(), error: null },
}: {
  readonly religionRows: readonly TestReligionRow[];
  readonly insertResult?: {
    readonly data: TestReligionRow | null;
    readonly error: { readonly message: string } | null;
  };
}): {
  readonly from: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "religions") {
        return createReligionsQueryBuilder(religionRows, insertResult);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createReligionsQueryBuilder(
  rows: readonly TestReligionRow[],
  insertResult: {
    readonly data: TestReligionRow | null;
    readonly error: { readonly message: string } | null;
  },
): unknown {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn(() => Promise.resolve({ data: rows, error: null })),
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
