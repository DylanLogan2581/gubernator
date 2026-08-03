import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  renderHook,
  waitFor,
  type RenderHookResult,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useAppShellWorldContext,
  type AppShellWorldContext,
} from "./UseAppShellWorldContext";

import type { JSX, ReactNode } from "react";

const WORLD_ID = "world-1";
const OTHER_WORLD_ID = "world-2";
const USER_ID = "user-1";
const LAST_WORLD_STORAGE_KEY = "gubernator:last-world";

const { requireSupabaseClient, useParams } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
  useParams: vi.fn<() => Record<string, string | undefined>>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

vi.mock("@tanstack/react-router", () => ({
  useParams,
}));

describe("useAppShellWorldContext sidebar fallback", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    useParams.mockReset();
    window.localStorage.clear();
  });

  it("resolves worldId from the route and ignores a stored pin for a different world", async () => {
    window.localStorage.setItem(LAST_WORLD_STORAGE_KEY, OTHER_WORLD_ID);
    useParams.mockReturnValue({ worldId: WORLD_ID });
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: [WORLD_ID],
        worldRows: [createWorldRow({ id: WORLD_ID })],
      }),
    );

    const { result } = renderContextHook();

    await waitFor(() => {
      expect(result.current.sidebarWorldName).toBe("World");
    });
    expect(result.current.worldId).toBe(WORLD_ID);
    expect(result.current.sidebarWorldId).toBe(WORLD_ID);
  });

  it("persists the current route world as the last-world pin", async () => {
    useParams.mockReturnValue({ worldId: WORLD_ID });
    requireSupabaseClient.mockReturnValue(
      createClient({ worldRows: [createWorldRow({ id: WORLD_ID })] }),
    );

    renderContextHook();

    await waitFor(() => {
      expect(window.localStorage.getItem(LAST_WORLD_STORAGE_KEY)).toBe(
        WORLD_ID,
      );
    });
  });

  it("falls back to the stored last-world id on a world-less route", async () => {
    window.localStorage.setItem(LAST_WORLD_STORAGE_KEY, WORLD_ID);
    useParams.mockReturnValue({});
    requireSupabaseClient.mockReturnValue(
      createClient({
        pcWorldIds: [WORLD_ID],
        worldRows: [createWorldRow({ id: WORLD_ID })],
      }),
    );

    const { result } = renderContextHook();

    await waitFor(() => {
      expect(result.current.sidebarWorldName).toBe("World");
    });
    expect(result.current.sidebarWorldId).toBe(WORLD_ID);
    expect(result.current.worldId).toBeNull();
  });

  it("clears an invalid stored pin and falls back to the reduced sidebar", async () => {
    window.localStorage.setItem(LAST_WORLD_STORAGE_KEY, "deleted-world");
    useParams.mockReturnValue({});
    requireSupabaseClient.mockReturnValue(createClient({ worldRows: [] }));

    const { result } = renderContextHook();

    await waitFor(() => {
      expect(result.current.sidebarWorldId).toBeNull();
    });
    await waitFor(() => {
      expect(window.localStorage.getItem(LAST_WORLD_STORAGE_KEY)).toBeNull();
    });
  });

  it("stays reduced with no route world and no stored pin", () => {
    useParams.mockReturnValue({});
    requireSupabaseClient.mockReturnValue(createClient({ worldRows: [] }));

    const { result } = renderContextHook();

    expect(result.current.worldId).toBeNull();
    expect(result.current.sidebarWorldId).toBeNull();
  });
});

let queryClient: QueryClient;

function Wrapper({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderContextHook(): RenderHookResult<AppShellWorldContext, unknown> {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderHook(() => useAppShellWorldContext(), { wrapper: Wrapper });
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
    id: WORLD_ID,
    incest_prevention_depth: 4,
    is_trashed: false,
    name: "World",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function createClient({
  pcWorldIds = [],
  worldRows,
}: {
  readonly pcWorldIds?: readonly string[];
  readonly worldRows: readonly TestWorldRow[];
}): unknown {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: USER_ID } } },
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
                  email: `${USER_ID}@example.com`,
                  id: USER_ID,
                  is_super_admin: false,
                  status: "active",
                  updated_at: "2026-01-01T00:00:00.000Z",
                  username: USER_ID,
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
            eq: vi.fn((column: string, value: string) => {
              const data =
                column === "id"
                  ? (worldRows.find((row) => row.id === value) ?? null)
                  : null;
              return {
                maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
              };
            }),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn((fn: string) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: pcWorldIds, error: null });
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    }),
  };
}
