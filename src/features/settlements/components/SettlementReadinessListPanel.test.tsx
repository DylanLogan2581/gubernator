import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAccessContext } from "@/features/permissions";
import type { WorldPermissionContext } from "@/features/worlds";

import { SettlementReadinessListPanel } from "./SettlementReadinessListPanel";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

describe("SettlementReadinessListPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("shows settlement readiness rows", async () => {
    requireSupabaseClient.mockReturnValue(
      createClientFixture({
        settlementRows: [
          createSettlementRow({
            auto_ready_enabled: true,
            id: "settlement-1",
            name: "Amberhold",
          }),
          createSettlementRow({
            id: "settlement-2",
            is_ready_current_turn: true,
            name: "Briarwatch",
            ready_set_at: "2026-05-02T12:00:00.000Z",
          }),
          createSettlementRow({
            id: "settlement-3",
            name: "Cinderford",
          }),
        ],
      }).client,
    );

    renderSettlementReadinessListPanel();

    expect(
      await screen.findByRole("heading", {
        name: "Settlement readiness list",
      }),
    ).toBeDefined();
    expectSettlementRow("Amberhold", "Auto-ready", "Never");
    expectSettlementRow("Briarwatch", "Ready", "2026-05-02T12:00:00.000Z");
    expectSettlementRow("Cinderford", "Not ready", "Never");
  });

  it("shows an empty state", async () => {
    requireSupabaseClient.mockReturnValue(
      createClientFixture({ settlementRows: [] }).client,
    );

    renderSettlementReadinessListPanel();

    expect(await screen.findByText("No settlements yet")).toBeDefined();
    expect(
      screen.getByText(
        "Settlement readiness appears here after settlements are created.",
      ),
    ).toBeDefined();
  });

  it("shows loading state before the list resolves", () => {
    requireSupabaseClient.mockReturnValue(createPendingClientFixture());

    renderSettlementReadinessListPanel();

    expect(
      screen.getByText("Loading settlement readiness list..."),
    ).toBeDefined();
  });

  it("shows query errors", async () => {
    requireSupabaseClient.mockReturnValue(
      createClientFixture({
        error: new Error("Readiness list unavailable."),
        settlementRows: [],
      }).client,
    );

    renderSettlementReadinessListPanel();

    expect(
      await screen.findByText("Settlement readiness list could not be loaded"),
    ).toBeDefined();
    expect(screen.getByText("Readiness list unavailable.")).toBeDefined();
  });

  it("sets manual readiness through the readiness mutation", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({
          id: "settlement-1",
          name: "Amberhold",
        }),
      ],
      updateResult: {
        data: {
          id: "settlement-1",
          is_ready_current_turn: true,
          ready_set_at: "2026-05-02T12:00:00.000Z",
        },
        error: null,
      },
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderSettlementReadinessListPanel();

    await user.click(
      await screen.findByRole("switch", {
        name: "Not ready",
      }),
    );

    expect(clientFixture.readEqId).toHaveBeenCalledWith("id", "settlement-1");
    expect(clientFixture.readEqWorldId).toHaveBeenCalledWith(
      "nations.world_id",
      "world-1",
    );
    expect(clientFixture.update).toHaveBeenCalledWith({
      is_ready_current_turn: true,
      ready_set_at: "now",
    });
    expect(clientFixture.updateEq).toHaveBeenCalledWith("id", "settlement-1");
  });

  it("clears manual readiness through the readiness mutation", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({
          id: "settlement-1",
          is_ready_current_turn: true,
          name: "Amberhold",
          ready_set_at: "2026-05-02T12:00:00.000Z",
        }),
      ],
      updateResult: {
        data: {
          id: "settlement-1",
          is_ready_current_turn: false,
          ready_set_at: null,
        },
        error: null,
      },
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderSettlementReadinessListPanel();

    await user.click(
      await screen.findByRole("switch", {
        name: "Ready",
      }),
    );

    expect(clientFixture.update).toHaveBeenCalledWith({
      is_ready_current_turn: false,
      ready_set_at: null,
    });
  });

  it("disables manual readiness for archived worlds", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({
          id: "settlement-1",
          name: "Amberhold",
        }),
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderSettlementReadinessListPanel({ isArchived: true });

    const switchControl = await screen.findByRole("switch", {
      name: "Not ready",
    });

    expect(switchControl).toBeDisabled();
    expect(
      screen.getByText(
        "Manual readiness is disabled because this world is archived.",
      ),
    ).toBeDefined();

    await user.click(switchControl);

    expect(clientFixture.update).not.toHaveBeenCalled();
  });

  it("disables manual readiness for auto-ready settlements and explains why", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({
          auto_ready_enabled: true,
          id: "settlement-1",
          name: "Amberhold",
        }),
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderSettlementReadinessListPanel();

    const switchControl = await screen.findByRole("switch", {
      name: "Not ready",
    });

    expect(switchControl).toBeDisabled();
    expect(screen.getByText("Auto-ready")).toBeDefined();
    expect(
      screen.getByText(
        "Auto-ready is enabled, so this settlement does not need manual readiness.",
      ),
    ).toBeDefined();

    await user.click(switchControl);

    expect(clientFixture.update).not.toHaveBeenCalled();
  });

  it("renders mutation errors as accessible alert text", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({
          id: "settlement-1",
          name: "Amberhold",
        }),
      ],
      updateResult: {
        data: null,
        error: {
          code: "42501",
          message: "permission denied for table settlements",
        },
      },
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderSettlementReadinessListPanel();

    await user.click(
      await screen.findByRole("switch", {
        name: "Not ready",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "permission denied for table settlements",
    );
  });
});

function renderSettlementReadinessListPanel({
  accessContext = createAdminAccessContext(),
  isArchived = false,
}: {
  readonly accessContext?: WorldPermissionContext;
  readonly isArchived?: boolean;
} = {}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SettlementReadinessListPanel
        accessContext={accessContext}
        isArchived={isArchived}
        worldId="world-1"
      />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

type TestSettlementReadinessListRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly name: string;
  readonly nation_id: string;
  readonly ready_set_at: string | null;
};
type TestSettlementReadinessAccessRow = {
  readonly id: string;
  readonly nations: {
    readonly world_id: string;
    readonly worlds: {
      readonly archived_at: string | null;
      readonly id: string;
      readonly owner_id: string;
      readonly status: string;
      readonly visibility: string;
    };
  };
};
type TestSettlementReadinessUpdateRow = {
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly ready_set_at: string | null;
};
type TestSupabaseError = {
  readonly code?: string;
  readonly message: string;
};
type TestSupabaseResult<TData> =
  | {
      readonly data: TData;
      readonly error: null;
    }
  | {
      readonly data: null;
      readonly error: TestSupabaseError | null;
    };

function createSettlementRow(
  overrides: Partial<TestSettlementReadinessListRow> = {},
): TestSettlementReadinessListRow {
  return {
    auto_ready_enabled: false,
    id: "settlement-1",
    is_ready_current_turn: false,
    name: "Settlement",
    nation_id: "nation-1",
    ready_set_at: null,
    ...overrides,
  };
}

function createClientFixture({
  accessResult = {
    data: createAccessRow(),
    error: null,
  },
  error = null,
  settlementRows,
  updateResult = {
    data: {
      id: "settlement-1",
      is_ready_current_turn: true,
      ready_set_at: "2026-05-02T12:00:00.000Z",
    },
    error: null,
  },
}: {
  readonly accessResult?: TestSupabaseResult<TestSettlementReadinessAccessRow>;
  readonly error?: Error | null;
  readonly settlementRows: readonly TestSettlementReadinessListRow[];
  readonly updateResult?: TestSupabaseResult<TestSettlementReadinessUpdateRow>;
}): {
  readonly client: unknown;
  readonly readEqId: ReturnType<typeof vi.fn>;
  readonly readEqWorldId: ReturnType<typeof vi.fn>;
  readonly update: ReturnType<typeof vi.fn>;
  readonly updateEq: ReturnType<typeof vi.fn>;
} {
  const settlementsBuilder = createSettlementsQueryBuilder({
    accessResult,
    error,
    rows: settlementRows,
    updateResult,
  });
  const client = {
    from: vi.fn((table: string) => {
      if (table === "settlements") {
        return settlementsBuilder.builder;
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return {
    client,
    readEqId: settlementsBuilder.readEqId,
    readEqWorldId: settlementsBuilder.readEqWorldId,
    update: settlementsBuilder.update,
    updateEq: settlementsBuilder.updateEq,
  };
}

function createPendingClientFixture(): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "settlements") {
        return createSettlementsQueryBuilder({
          accessResult: { data: createAccessRow(), error: null },
          error: null,
          rows: new Promise<readonly TestSettlementReadinessListRow[]>(() => {
            // Keep the query pending for the loading-state assertion.
          }),
          updateResult: {
            data: {
              id: "settlement-1",
              is_ready_current_turn: true,
              ready_set_at: "2026-05-02T12:00:00.000Z",
            },
            error: null,
          },
        }).builder;
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createSettlementsQueryBuilder({
  accessResult,
  error,
  rows,
  updateResult,
}: {
  readonly accessResult: TestSupabaseResult<TestSettlementReadinessAccessRow>;
  readonly error: Error | null;
  readonly rows:
    | readonly TestSettlementReadinessListRow[]
    | Promise<readonly TestSettlementReadinessListRow[]>;
  readonly updateResult: TestSupabaseResult<TestSettlementReadinessUpdateRow>;
}): {
  readonly builder: unknown;
  readonly readEqId: ReturnType<typeof vi.fn>;
  readonly readEqWorldId: ReturnType<typeof vi.fn>;
  readonly update: ReturnType<typeof vi.fn>;
  readonly updateEq: ReturnType<typeof vi.fn>;
} {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn(async () => ({
      data: await rows,
      error,
    })),
    select: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(accessResult),
  };
  const readEqWorldId = vi.fn(() => ({ maybeSingle: builder.maybeSingle }));
  const readEqId = vi.fn(() => ({ eq: readEqWorldId }));
  const readBuilder = {
    eq: readEqId,
    order: builder.order,
    returns: builder.returns,
  };
  const updateMaybeSingle = vi.fn().mockResolvedValue(updateResult);
  const updateSelect = vi.fn(() => ({ maybeSingle: updateMaybeSingle }));
  const updateEq = vi.fn(() => ({ select: updateSelect }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const rootBuilder = {
    select: vi.fn((selection: string) => {
      if (selection.startsWith("id,nations!inner")) {
        return readBuilder;
      }

      return builder;
    }),
    update,
  };

  return {
    builder: rootBuilder,
    readEqId,
    readEqWorldId,
    update,
    updateEq,
  };
}

function expectSettlementRow(
  settlementName: string,
  state: string,
  lastReady: string,
): void {
  const nameCell = screen.getByText(settlementName);
  const row = nameCell.closest("tr");

  expect(row).not.toBeNull();
  expect(row).toHaveTextContent(state);
  expect(row).toHaveTextContent(lastReady);
}

function createAccessRow(): TestSettlementReadinessAccessRow {
  return {
    id: "settlement-1",
    nations: {
      world_id: "world-1",
      worlds: {
        archived_at: null,
        id: "world-1",
        owner_id: "user-1",
        status: "active",
        visibility: "private",
      },
    },
  };
}

function createAdminAccessContext(): WorldPermissionContext {
  return createAccessContext({
    isSuperAdmin: false,
    userId: "user-1",
    worldAdminWorldIds: [],
  });
}
