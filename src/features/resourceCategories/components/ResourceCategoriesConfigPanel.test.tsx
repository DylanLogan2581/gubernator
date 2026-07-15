import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResourceCategoriesConfigPanel } from "./ResourceCategoriesConfigPanel";

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

describe("ResourceCategoriesConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("clears the name validation error as soon as the user types", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({ categoryRows: [] }));

    render(
      <QueryClientProvider client={createQueryClient()}>
        <ResourceCategoriesConfigPanel
          canAdmin={true}
          isArchived={false}
          worldId={WORLD_ID}
        />
      </QueryClientProvider>,
    );

    await screen.findByText("No resource categories yet");
    await user.click(screen.getByRole("button", { name: "Add category" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Create resource category",
    });
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(
      await within(dialog).findByText("Resource category name is required."),
    ).toBeDefined();

    await user.type(
      within(dialog).getByRole("textbox", { name: "Name" }),
      "Metals",
    );

    expect(
      within(dialog).queryByText("Resource category name is required."),
    ).toBeNull();
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

type TestResourceCategoryRow = {
  readonly color: string;
  readonly created_at: string;
  readonly icon: string | null;
  readonly id: string;
  readonly name: string;
  readonly sort_order: number;
  readonly updated_at: string;
  readonly world_id: string;
};

function createClient({
  categoryRows,
}: {
  readonly categoryRows: readonly TestResourceCategoryRow[];
}): {
  readonly from: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "resource_categories") {
        return createResourceCategoriesQueryBuilder(categoryRows);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createResourceCategoriesQueryBuilder(
  categoryRows: readonly TestResourceCategoryRow[],
): Record<string, unknown> {
  const builder: Record<string, unknown> = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue({ data: categoryRows, error: null }),
  };
  return { select: vi.fn(() => builder) };
}
