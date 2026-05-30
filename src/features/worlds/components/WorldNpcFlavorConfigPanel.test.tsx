import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAccessContext,
  type AccessContext,
} from "@/features/permissions";

import { WorldNpcFlavorConfigPanel } from "./WorldNpcFlavorConfigPanel";

import type { WorldNpcFlavorConfig } from "../schemas/worldNpcFlavorConfigSchemas";

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

describe("WorldNpcFlavorConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("emits a success toast after saving the NPC flavor config", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({ worldRows: [createWorldRow()] }),
    );

    renderPanel({
      accessContext: createAccessContext({
        isSuperAdmin: false,
        userId: "user-1",
        worldAdminWorldIds: [],
      }),
      canAdmin: true,
      isArchived: false,
    });

    await screen.findByRole("heading", { name: "NPC flavor pools" });
    await user.click(screen.getByRole("button", { name: "Save pools" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "NPC flavor pools saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("emits an error toast when saving the NPC flavor config fails", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        updateResult: {
          data: null,
          error: { message: "permission denied" },
        },
        worldRows: [createWorldRow()],
      }),
    );

    renderPanel({
      accessContext: createAccessContext({
        isSuperAdmin: false,
        userId: "user-1",
        worldAdminWorldIds: [],
      }),
      canAdmin: true,
      isArchived: false,
    });

    await screen.findByRole("heading", { name: "NPC flavor pools" });
    await user.click(screen.getByRole("button", { name: "Save pools" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("permission denied"),
      );
    });
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("generate example output button is hidden for read-only viewers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ worldRows: [createWorldRow()] }),
    );

    renderPanel({
      accessContext: createAccessContext({
        isSuperAdmin: false,
        userId: "reader-1",
        worldAdminWorldIds: [],
      }),
      canAdmin: false,
      isArchived: false,
    });

    await screen.findByRole("heading", { name: "NPC flavor pools" });
    expect(
      screen.queryByRole("button", { name: "Generate example output" }),
    ).toBeNull();
  });

  it("clicking generate example output renders a read-only preview sentence", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({ worldRows: [createWorldRow()] }),
    );

    renderPanel({
      accessContext: createAccessContext({
        isSuperAdmin: false,
        userId: "user-1",
        worldAdminWorldIds: [],
      }),
      canAdmin: true,
      isArchived: false,
    });

    await screen.findByRole("heading", { name: "NPC flavor pools" });
    const initialTextboxCount = screen.getAllByRole("textbox").length;

    await user.click(
      screen.getByRole("button", { name: "Generate example output" }),
    );

    expect(screen.getByText(/^A .+ who is curious/)).toBeDefined();
    expect(screen.getAllByRole("textbox").length).toBe(initialTextboxCount);
  });

  it("renders read-only summary without save controls for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ worldRows: [createWorldRow()] }),
    );

    renderPanel({
      accessContext: createAccessContext({
        isSuperAdmin: false,
        userId: "reader-1",
        worldAdminWorldIds: [],
      }),
      canAdmin: false,
      isArchived: false,
    });

    expect(
      await screen.findByRole("heading", { name: "NPC flavor pools" }),
    ).toBeDefined();
    expect(screen.getByText("Read-only")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Save pools" })).toBeNull();
  });
});

function renderPanel({
  accessContext,
  canAdmin,
  isArchived,
}: {
  readonly accessContext: AccessContext;
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <WorldNpcFlavorConfigPanel
        accessContext={accessContext}
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

function createClient({
  updateResult = { data: { id: WORLD_ID }, error: null },
  worldRows,
  jobRows = [],
}: {
  readonly updateResult?: {
    readonly data: { readonly id: string } | null;
    readonly error: { readonly message: string } | null;
  };
  readonly worldRows: readonly TestWorldRow[];
  readonly jobRows?: readonly unknown[];
}): {
  readonly from: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "worlds") {
        return createWorldsQueryBuilder(worldRows, updateResult);
      }
      if (table === "job_definitions") {
        return createJobsQueryBuilder(jobRows);
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

type TestWorldRow = {
  readonly archived_at: string | null;
  readonly id: string;
  readonly npc_flavor_config_json: WorldNpcFlavorConfig;
  readonly owner_id: string;
  readonly status: string;
  readonly visibility: string;
};

function createWorldRow(overrides: Partial<TestWorldRow> = {}): TestWorldRow {
  return {
    archived_at: null,
    id: WORLD_ID,
    npc_flavor_config_json: createNpcFlavorConfig(),
    owner_id: "user-1",
    status: "active",
    visibility: "private",
    ...overrides,
  };
}

function createNpcFlavorConfig(): WorldNpcFlavorConfig {
  return {
    contradictions: ["stoic but theatrical"],
    flaws: ["impatient"],
    goals: ["reclaim a lost relic"],
    traits: ["curious"],
  };
}

function createWorldsQueryBuilder(
  rows: readonly TestWorldRow[],
  updateResult: {
    readonly data: { readonly id: string } | null;
    readonly error: { readonly message: string } | null;
  },
): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn((column: string, value: string) => {
        const data =
          column === "id"
            ? (rows.find((row) => row.id === value) ?? null)
            : null;

        return {
          maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
        };
      }),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue(updateResult),
          })),
        })),
      })),
    })),
  };
}

function createJobsQueryBuilder(rows: readonly unknown[]): unknown {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return {
    select: vi.fn(() => selectBuilder),
  };
}
