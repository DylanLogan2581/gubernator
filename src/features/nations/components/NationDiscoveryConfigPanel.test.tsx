import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { NationDiscoveryConfigPanel } from "./NationDiscoveryConfigPanel";

import type { JSX } from "react";

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

describe("NationDiscoveryConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("renders the discovery matrix and lets an admin mark a pair as met", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      discoveryRows: [],
      nationRows: [
        { id: "nation-1", name: "Nation A" },
        { id: "nation-2", name: "Nation B" },
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderPanel({ canAdmin: true, isArchived: false });

    expect(await screen.findByRole("table")).toBeDefined();
    const cell = screen.getByRole("button", {
      name: "Nation A ↔ Nation B: not discovered",
    });
    expect(cell).toHaveAttribute("aria-pressed", "false");

    await user.click(cell);

    await waitFor(() => {
      expect(clientFixture.rpc).toHaveBeenCalledWith("set_nations_met", {
        p_a: "nation-1",
        p_b: "nation-2",
      });
    });
  });

  it("disables toggles for a non-admin viewer", async () => {
    const clientFixture = createClientFixture({
      discoveryRows: [
        {
          nation_a_id: "nation-1",
          nation_b_id: "nation-2",
          met_at_turn_number: 3,
          created_by_user_id: null,
        },
      ],
      nationRows: [
        { id: "nation-1", name: "Nation A" },
        { id: "nation-2", name: "Nation B" },
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByRole("table");
    const cell = screen.getByRole("button", {
      name: "Nation A ↔ Nation B: discovered",
    });
    expect(cell).toHaveAttribute("aria-pressed", "true");
    expect(cell).toBeDisabled();
  });
});

function renderPanel({
  canAdmin,
  isArchived,
}: {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
}): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <NationDiscoveryConfigPanel
            canAdmin={canAdmin}
            isArchived={isArchived}
            worldId="world-1"
          />
        </TooltipProvider>
      </QueryClientProvider>
    ) as JSX.Element,
  );
}

function createClientFixture({
  discoveryRows,
  nationRows,
}: {
  readonly discoveryRows: readonly {
    readonly nation_a_id: string;
    readonly nation_b_id: string;
    readonly met_at_turn_number: number;
    readonly created_by_user_id: string | null;
  }[];
  readonly nationRows: readonly {
    readonly id: string;
    readonly name: string;
  }[];
}): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn((table: string) => {
    if (table === "nations") {
      return createNationsBuilder(nationRows);
    }
    if (table === "nation_discoveries") {
      return createDiscoveriesBuilder(discoveryRows);
    }
    throw new Error(`Unexpected table ${table}`);
  });
  const client = { from, rpc } as unknown as GubernatorSupabaseClient;

  return { client, rpc };
}

function createNationsBuilder(
  rows: readonly { readonly id: string; readonly name: string }[],
): { readonly select: ReturnType<typeof vi.fn> } {
  const fullRows = rows.map((row) => ({
    id: row.id,
    world_id: "world-1",
    name: row.name,
    description: null,
    nameset_id: null,
    capital_settlement_id: null,
    founded_turn_number: null,
    government_type: "monarchy",
    flag_path: null,
    tax_rate: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }));
  const returns = vi.fn().mockResolvedValue({ data: fullRows, error: null });
  const order2 = vi.fn(() => ({ returns }));
  const order1 = vi.fn(() => ({ order: order2 }));
  const eq = vi.fn(() => ({ order: order1 }));
  const select = vi.fn(() => ({ eq }));
  return { select };
}

function createDiscoveriesBuilder(
  rows: readonly {
    readonly nation_a_id: string;
    readonly nation_b_id: string;
    readonly met_at_turn_number: number;
    readonly created_by_user_id: string | null;
  }[],
): { readonly select: ReturnType<typeof vi.fn> } {
  const returns = vi.fn().mockResolvedValue({ data: rows, error: null });
  const eq = vi.fn(() => ({ returns }));
  const select = vi.fn(() => ({ eq }));
  return { select };
}
