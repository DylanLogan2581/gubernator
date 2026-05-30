import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAccessContext,
  type AccessContext,
} from "@/features/permissions";

import { WorldPopulationRulesConfigPanel } from "./WorldPopulationRulesConfigPanel";

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

describe("WorldPopulationRulesConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("emits a success toast after saving population rules", async () => {
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

    await screen.findByRole("heading", { name: "Population rules" });
    await user.click(screen.getByRole("button", { name: "Save rules" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Population rules saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("emits an error toast when saving population rules fails", async () => {
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

    await screen.findByRole("heading", { name: "Population rules" });
    await user.click(screen.getByRole("button", { name: "Save rules" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("permission denied"),
      );
    });
    expect(toastSuccess).not.toHaveBeenCalled();
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
      await screen.findByRole("heading", { name: "Population rules" }),
    ).toBeDefined();
    expect(screen.getByText("Read-only")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Save rules" })).toBeNull();
  });

  it("shows nullable maximum fertility age as No cap when null", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        worldRows: [createWorldRow({ maximum_fertility_age_turns: null })],
      }),
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

    await screen.findByRole("heading", { name: "Population rules" });
    expect(screen.getByText("No cap")).toBeDefined();
  });

  it("shows a set value for maximum fertility age when non-null", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        worldRows: [createWorldRow({ maximum_fertility_age_turns: 60 })],
      }),
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

    await screen.findByRole("heading", { name: "Population rules" });
    expect(screen.getByText("60 turns")).toBeDefined();
  });

  it("displays probability fields as whole-number percentages in read-only summary", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        worldRows: [
          createWorldRow({
            fertility_chance: 0.1,
            partnership_seek_chance: 0.3,
          }),
        ],
      }),
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

    await screen.findByRole("heading", { name: "Population rules" });
    expect(screen.getByText("30%")).toBeDefined();
    expect(screen.getByText("10%")).toBeDefined();
  });

  it("converts displayed whole-percent input to a 0–1 float on save", async () => {
    const user = userEvent.setup();

    const updateSpy = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: { id: WORLD_ID }, error: null }),
          })),
        })),
      })),
    }));

    requireSupabaseClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "worlds") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((column: string, value: string) => {
                const row = createWorldRow({ partnership_seek_chance: 0.3 });
                const data = column === "id" && value === WORLD_ID ? row : null;
                return {
                  maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
                };
              }),
            })),
            update: updateSpy,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    renderPanel({
      accessContext: createAccessContext({
        isSuperAdmin: false,
        userId: "user-1",
        worldAdminWorldIds: [],
      }),
      canAdmin: true,
      isArchived: false,
    });

    await screen.findByRole("heading", { name: "Population rules" });

    const input = screen.getByRole("spinbutton", {
      name: /Partnership seek chance/,
    });
    fireEvent.change(input, { target: { value: "50" } });

    await user.click(screen.getByRole("button", { name: "Save rules" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled();
    });

    const calls = updateSpy.mock.calls as unknown[][];
    const payload = calls[0]?.[0] as Record<string, unknown>;
    expect(payload?.["partnership_seek_chance"]).toBe(0.5);
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
      <WorldPopulationRulesConfigPanel
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
}: {
  readonly updateResult?: {
    readonly data: { readonly id: string } | null;
    readonly error: { readonly message: string } | null;
  };
  readonly worldRows: readonly TestWorldRow[];
}): {
  readonly from: ReturnType<typeof vi.fn>;
} {
  return {
    from: vi.fn((table: string) => {
      if (table === "worlds") {
        return createWorldsQueryBuilder(worldRows, updateResult);
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

type TestWorldRow = {
  readonly archived_at: string | null;
  readonly fertility_chance: number;
  readonly food_consumption_per_citizen: number;
  readonly homelessness_decline_rate: number;
  readonly id: string;
  readonly incest_prevention_depth: number;
  readonly maximum_fertility_age_turns: number | null;
  readonly minimum_partnership_age_turns: number;
  readonly mourning_period_turns: number;
  readonly owner_id: string;
  readonly partnership_seek_chance: number;
  readonly starvation_severity_multiplier: number;
  readonly status: string;
  readonly visibility: string;
  readonly water_consumption_per_citizen: number;
};

function createWorldRow(overrides: Partial<TestWorldRow> = {}): TestWorldRow {
  return {
    archived_at: null,
    fertility_chance: 0.1,
    food_consumption_per_citizen: 1.0,
    homelessness_decline_rate: 0.1,
    id: WORLD_ID,
    incest_prevention_depth: 4,
    maximum_fertility_age_turns: null,
    minimum_partnership_age_turns: 18,
    mourning_period_turns: 3,
    owner_id: "user-1",
    partnership_seek_chance: 0.3,
    starvation_severity_multiplier: 1.0,
    status: "active",
    visibility: "private",
    water_consumption_per_citizen: 1.0,
    ...overrides,
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
