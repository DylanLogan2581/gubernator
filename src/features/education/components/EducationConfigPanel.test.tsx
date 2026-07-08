import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EducationConfigPanel } from "./EducationConfigPanel";

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
const EDUCATION_LEVEL_ID = "00000000-0000-0000-0000-000000000002";

describe("EducationConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("emits a success toast after creating an education level", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({ rows: [] }));

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Education" });
    await user.click(screen.getByRole("button", { name: "Add level" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create education level",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Illiterate",
    );

    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Education level created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows inline validation error when name is empty", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({ rows: [] }));

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByRole("heading", { name: "Education" });
    await user.click(screen.getByRole("button", { name: "Add level" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create education level",
    });
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(
      await screen.findByText("Education level name is required."),
    ).toBeDefined();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("shows empty state when there are no education levels", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ rows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText("No education levels yet")).toBeDefined();
  });

  it("hides the Add level button for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ rows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("No education levels yet");
    expect(screen.queryByRole("button", { name: "Add level" })).toBeNull();
  });

  it("lists existing education levels ordered by rank", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        rows: [createEducationLevelRow({ name: "Illiterate", rank: 1 })],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText("Illiterate")).toBeDefined();
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
      <EducationConfigPanel
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

type TestEducationLevelRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly rank: number;
  readonly updated_at: string;
  readonly world_id: string;
};

function createEducationLevelRow(
  overrides: Partial<TestEducationLevelRow> = {},
): TestEducationLevelRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    description: null,
    id: EDUCATION_LEVEL_ID,
    name: "Illiterate",
    rank: 1,
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createClient({
  rows,
  createResult = { data: createEducationLevelRow(), error: null },
}: {
  readonly rows: readonly TestEducationLevelRow[];
  readonly createResult?: {
    readonly data: TestEducationLevelRow | null;
    readonly error: { readonly message: string } | null;
  };
}): {
  readonly from: ReturnType<typeof vi.fn>;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "education_levels") {
        return createEducationLevelsQueryBuilder(rows);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue(createResult),
    })),
  };
}

function createEducationLevelsQueryBuilder(
  rows: readonly TestEducationLevelRow[],
): unknown {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  };

  return {
    select: vi.fn(() => selectBuilder),
  };
}
