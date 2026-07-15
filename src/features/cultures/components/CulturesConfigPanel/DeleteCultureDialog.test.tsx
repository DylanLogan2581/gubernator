import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteCultureDialog } from "./DeleteCultureDialog";

import type { Culture } from "../../types/cultureTypes";

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
const CULTURE_ID = "00000000-0000-0000-0000-000000000002";
const OTHER_CULTURE_ID = "00000000-0000-0000-0000-000000000003";

const CULTURE: Culture = {
  color: "#6b7280",
  createdAt: "2026-01-01T00:00:00.000Z",
  description: null,
  id: CULTURE_ID,
  name: "Coastal Folk",
  updatedAt: "2026-01-01T00:00:00.000Z",
  worldId: WORLD_ID,
};

const OTHER_CULTURE: Culture = {
  color: "#123abc",
  createdAt: "2026-01-01T00:00:00.000Z",
  description: null,
  id: OTHER_CULTURE_ID,
  name: "Mountain Folk",
  updatedAt: "2026-01-01T00:00:00.000Z",
  worldId: WORLD_ID,
};

describe("DeleteCultureDialog", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("shows usage counts and calls delete_culture with a null reassignment target by default", async () => {
    const user = userEvent.setup();
    const { rpc } = mockClient({
      citizenCount: 3,
      cultureRows: [CULTURE, OTHER_CULTURE],
      nationCount: 2,
    });

    renderDialog();

    await screen.findByText(
      '3 citizens and 2 nations currently reference "Coastal Folk".',
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith("delete_culture", {
        p_culture_id: CULTURE_ID,
        p_reassign_to_id: null,
      });
    });
  });

  it("calls delete_culture with the selected reassignment target", async () => {
    const user = userEvent.setup();
    const { rpc } = mockClient({
      citizenCount: 1,
      cultureRows: [CULTURE, OTHER_CULTURE],
      nationCount: 0,
    });

    renderDialog();

    const select = await screen.findByRole("combobox", {
      name: "Reassign references to",
    });
    await user.selectOptions(select, OTHER_CULTURE_ID);
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith("delete_culture", {
        p_culture_id: CULTURE_ID,
        p_reassign_to_id: OTHER_CULTURE_ID,
      });
    });
  });

  it("clears the reassignment option when only one culture exists", async () => {
    mockClient({
      citizenCount: 1,
      cultureRows: [CULTURE],
      nationCount: 0,
    });

    renderDialog();

    expect(
      await screen.findByText(
        /References will be cleared — no other cultures exist/,
      ),
    ).toBeDefined();
    expect(
      screen.queryByRole("combobox", { name: "Reassign references to" }),
    ).toBeNull();
  });

  it("shows a plain confirm and no reassignment UI when nothing references the culture", async () => {
    mockClient({
      citizenCount: 0,
      cultureRows: [CULTURE, OTHER_CULTURE],
      nationCount: 0,
    });

    renderDialog();

    expect(
      await screen.findByText('Delete "Coastal Folk"? Nothing references it.'),
    ).toBeDefined();
    expect(
      screen.queryByRole("combobox", { name: "Reassign references to" }),
    ).toBeNull();
    expect(
      screen.queryByText(/What should happen to those references/),
    ).toBeNull();
  });
});

function renderDialog(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <DeleteCultureDialog
        culture={CULTURE}
        queryClient={new QueryClient()}
        worldId={WORLD_ID}
        onClose={() => {}}
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

function mockClient({
  citizenCount,
  cultureRows,
  nationCount,
}: {
  readonly citizenCount: number;
  readonly cultureRows: readonly Culture[];
  readonly nationCount: number;
}): {
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const cultureQueryRows = cultureRows.map((culture) => ({
    color: culture.color,
    created_at: culture.createdAt,
    description: culture.description,
    id: culture.id,
    name: culture.name,
    updated_at: culture.updatedAt,
    world_id: culture.worldId,
  }));

  const rpc = vi.fn(() => ({
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: CULTURE_ID, world_id: WORLD_ID },
      error: null,
    }),
  }));

  const from = vi.fn((table: string) => {
    if (table === "cultures") {
      const builder: Record<string, unknown> = {
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        returns: vi.fn(() =>
          Promise.resolve({ data: cultureQueryRows, error: null }),
        ),
      };
      return { select: vi.fn(() => builder) };
    }
    if (table === "citizens") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ count: citizenCount, error: null }),
        })),
      };
    }
    if (table === "nations") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ count: nationCount, error: null }),
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  requireSupabaseClient.mockReturnValue({ from, rpc });

  return { rpc };
}
