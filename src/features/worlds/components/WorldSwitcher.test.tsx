import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

import { WorldSwitcher } from "./WorldSwitcher";

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
    search,
    to,
  }: {
    readonly children: ReactNode;
    readonly params?: Readonly<Record<string, string>>;
    readonly search?: Readonly<Record<string, string>>;
    readonly to: string;
  }) => {
    const path =
      params === undefined
        ? to
        : Object.entries(params).reduce(
            (acc, [name, value]) => acc.replace(`$${name}`, value),
            to,
          );
    const href =
      search === undefined
        ? path
        : `${path}?${new URLSearchParams(search).toString()}`;
    return <a href={href}>{children}</a>;
  },
}));

describe("WorldSwitcher", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("shows a 'Select a world' placeholder outside a world", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ isSuperAdmin: false, worldRows: [] }),
    );

    renderSwitcher({ turnLabel: null, worldId: null, worldName: null });

    expect(await screen.findByText("Select a world")).toBeDefined();
  });

  it("shows the current world name and turn/date label in-world", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ isSuperAdmin: false, worldRows: [] }),
    );

    renderSwitcher({
      turnLabel: "Turn 3 · Spring, Year 1",
      worldId: "world-1",
      worldName: "Aeloria",
    });

    expect(await screen.findByText("Aeloria")).toBeDefined();
    expect(screen.getByText("Turn 3 · Spring, Year 1")).toBeDefined();
  });

  it("lists accessible worlds and navigates on selection", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        isSuperAdmin: false,
        worldRows: [
          createWorldRow({ id: "world-1", name: "Aeloria" }),
          createWorldRow({ id: "world-2", name: "Bastion" }),
        ],
      }),
    );

    renderSwitcher({
      turnLabel: "Turn 3 · Spring, Year 1",
      worldId: "world-1",
      worldName: "Aeloria",
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Aeloria/ }));

    const otherWorldLink = await screen.findByRole("link", {
      name: /Bastion/,
    });
    expect(otherWorldLink).toHaveAttribute("href", "/worlds/world-2");

    const allWorldsLink = screen.getByRole("link", { name: "All worlds" });
    expect(allWorldsLink).toHaveAttribute("href", "/worlds");
  });

  it("hides Create world/Import entries for non-superadmins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ isSuperAdmin: false, worldRows: [] }),
    );

    renderSwitcher({ turnLabel: null, worldId: null, worldName: null });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Select a world" }));

    expect(screen.queryByRole("link", { name: /Create world/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Import/ })).toBeNull();
  });

  it("shows Create world/Import entries for superadmins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ isSuperAdmin: true, worldRows: [] }),
    );

    renderSwitcher({ turnLabel: null, worldId: null, worldName: null });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Select a world" }));

    expect(
      await screen.findByRole("link", { name: /Create world/ }),
    ).toHaveAttribute("href", "/worlds?action=create");
    expect(screen.getByRole("link", { name: /Import/ })).toHaveAttribute(
      "href",
      "/worlds?action=import",
    );
  });
});

function renderSwitcher({
  turnLabel,
  worldId,
  worldName,
}: {
  readonly turnLabel: string | null;
  readonly worldId: string | null;
  readonly worldName: string | null;
}): ReturnType<typeof render> {
  return render(
    <TooltipProvider>
      <QueryClientProvider client={createQueryClient()}>
        <SidebarProvider>
          <WorldSwitcher
            turnLabel={turnLabel}
            worldId={worldId}
            worldName={worldName}
          />
        </SidebarProvider>
      </QueryClientProvider>
    </TooltipProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

type TestWorldRow = {
  readonly archived_at: string | null;
  readonly calendar_config_json: unknown;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly incest_prevention_depth: number;
  readonly is_trashed: boolean;
  readonly name: string;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
};

function createWorldRow(overrides: Partial<TestWorldRow> = {}): TestWorldRow {
  return {
    archived_at: null,
    calendar_config_json: {
      months: [{ dayCount: 30, name: "Spring" }],
      startTurnNumber: 1,
    },
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 1,
    id: "00000000-0000-0000-0000-000000000001",
    incest_prevention_depth: 4,
    is_trashed: false,
    name: "World",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "public",
    ...overrides,
  };
}

function createClient({
  isSuperAdmin,
  worldRows,
}: {
  readonly isSuperAdmin: boolean;
  readonly worldRows: readonly TestWorldRow[];
}): unknown {
  const userId = "user-1";
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: { user: { id: userId } },
        },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  created_at: "2026-01-01T00:00:00.000Z",
                  email: `${userId}@example.com`,
                  id: userId,
                  is_super_admin: isSuperAdmin,
                  status: "active",
                  updated_at: "2026-01-01T00:00:00.000Z",
                  username: userId,
                },
                error: null,
              }),
            })),
          })),
        };
      }

      if (table === "world_admins") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        };
      }

      if (table === "worlds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi
                .fn()
                .mockResolvedValue({ data: worldRows, error: null }),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn((fn: string) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: [], error: null });
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    }),
  };
}
