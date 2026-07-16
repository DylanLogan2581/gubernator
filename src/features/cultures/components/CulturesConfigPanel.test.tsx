import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CulturesConfigPanel } from "./CulturesConfigPanel";

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
    readonly params: { readonly cultureId: string; readonly worldId: string };
  }) => (
    <a
      href={`/worlds/${params.worldId}/configuration/cultures/${params.cultureId}`}
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
const CULTURE_ID = "00000000-0000-0000-0000-000000000002";

describe("CulturesConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("emits a success toast after creating a culture", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({ cultureRows: [] }));

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Cultures" });
    await user.click(screen.getByRole("button", { name: "Add culture" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create culture",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Coastal Folk",
    );

    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Culture created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows inline validation error when name is empty", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({ cultureRows: [] }));

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Cultures" });
    await user.click(screen.getByRole("button", { name: "Add culture" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create culture",
    });
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Culture name is required.")).toBeDefined();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("shows empty state when there are no cultures", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ cultureRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText("No cultures yet")).toBeDefined();
  });

  it("hides the Add culture button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ cultureRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("No cultures yet");
    expect(screen.queryByRole("button", { name: "Add culture" })).toBeNull();
  });

  it("lists existing cultures", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        cultureRows: [createCultureRow({ name: "Coastal Folk" })],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText("Coastal Folk")).toBeDefined();
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
      <CulturesConfigPanel
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

type TestCultureRow = {
  readonly color: string;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly updated_at: string;
  readonly world_id: string;
};

function createCultureRow(
  overrides: Partial<TestCultureRow> = {},
): TestCultureRow {
  return {
    color: "#6b7280",
    created_at: "2026-01-01T00:00:00.000Z",
    description: null,
    id: CULTURE_ID,
    name: "Coastal Folk",
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createClient({
  cultureRows,
  insertResult = { data: createCultureRow(), error: null },
}: {
  readonly cultureRows: readonly TestCultureRow[];
  readonly insertResult?: {
    readonly data: TestCultureRow | null;
    readonly error: { readonly message: string } | null;
  };
}): {
  readonly from: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "cultures") {
        return createCulturesQueryBuilder(cultureRows, insertResult);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createCulturesQueryBuilder(
  rows: readonly TestCultureRow[],
  insertResult: {
    readonly data: TestCultureRow | null;
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
