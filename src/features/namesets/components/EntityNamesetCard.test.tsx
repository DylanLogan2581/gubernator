import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NationNamesetCard } from "./EntityNamesetCard";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const NATION_ID = "00000000-0000-0000-0000-000000000002";
const NAMESET_ID = "00000000-0000-0000-0000-000000000003";
const DEFAULT_NAMESET_ID = "00000000-0000-0000-0000-000000000004";
const TRASHED_NAMESET_ID = "00000000-0000-0000-0000-000000000005";

type NamesetRow = {
  readonly id: string;
  readonly world_id: string;
  readonly name: string;
  readonly config_json: Record<string, unknown>;
  readonly is_default: boolean;
  readonly is_trashed: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

function createNamesetRow(overrides: Partial<NamesetRow> = {}): NamesetRow {
  return {
    id: NAMESET_ID,
    world_id: WORLD_ID,
    name: "Norse",
    config_json: {
      convention: "pool",
      female_given_names: [],
      male_given_names: [],
      surnames: [],
    },
    is_default: false,
    is_trashed: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("NationNamesetCard", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("shows an explicit removed-nameset alert when the assigned nameset is trashed", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient([
        createNamesetRow({
          id: DEFAULT_NAMESET_ID,
          name: "World Default",
          is_default: true,
        }),
      ]),
    );

    renderCard({ currentNamesetId: TRASHED_NAMESET_ID });

    expect(
      await screen.findByText("Assigned nameset was removed"),
    ).toBeDefined();
    expect(
      screen.getByRole("combobox", { name: "Nameset override" }),
    ).toHaveValue("");
  });

  it("does not show the removed-nameset alert when the assigned nameset is active", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient([createNamesetRow({ id: NAMESET_ID, name: "Norse" })]),
    );

    renderCard({ currentNamesetId: NAMESET_ID });

    await screen.findByRole("combobox", { name: "Nameset override" });
    expect(screen.queryByText("Assigned nameset was removed")).toBeNull();
  });

  it("shows a zero-active-namesets empty state instead of a disabled select", async () => {
    requireSupabaseClient.mockReturnValue(createClient([]));

    renderCard({ currentNamesetId: null });

    expect(await screen.findByText("No namesets available")).toBeDefined();
    expect(
      screen.queryByRole("combobox", { name: "Nameset override" }),
    ).toBeNull();
  });
});

function renderCard({
  currentNamesetId,
}: {
  readonly currentNamesetId: string | null;
}): void {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <NationNamesetCard
        canAdmin={true}
        isArchived={false}
        nationId={NATION_ID}
        currentNamesetId={currentNamesetId}
        worldId={WORLD_ID}
      />
    </QueryClientProvider>,
  );
}

function createClient(rows: readonly NamesetRow[]): unknown {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "namesets") {
        return { select: vi.fn(() => selectBuilder) };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  };
}
