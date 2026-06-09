import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAccessContext } from "@/features/permissions";
import type { WorldPermissionContext } from "@/features/worlds";

import { SettlementReadinessListPanel } from "./SettlementReadinessListPanel";

import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    readonly children: ReactNode;
    readonly to: string;
    readonly params?: Readonly<Record<string, string>>;
    readonly className?: string;
  }) => {
    const href =
      params === undefined
        ? to
        : Object.entries(params).reduce(
            (path, [name, value]) => path.replace(`$${name}`, value),
            to,
          );
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
}));

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

describe("SettlementReadinessListPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("shows settlement readiness rows", async () => {
    const user = userEvent.setup();
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
            last_ready_at: "2026-05-02T12:00:00.000Z",
            name: "Briarwatch",
            ready_set_at: "2026-05-02T12:00:00.000Z",
          }),
          createSettlementRow({
            id: "settlement-4",
            last_ready_at: "2026-05-01T09:30:22.123456+00:00",
            name: "Dawnport",
            ready_set_at: null,
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
        name: "Readiness Summary",
      }),
    ).toBeDefined();
    await user.click(screen.getByRole("button", { name: /Nation A/ }));
    expectSettlementRow("Amberhold");
    expectSettlementRow("Briarwatch");
    expectSettlementRow("Dawnport");
    expectSettlementRow("Cinderford");
  });

  it("links settlement names to their detail pages", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClientFixture({
        settlementRows: [
          createSettlementRow({
            id: "settlement-1",
            name: "Amberhold",
            nation_id: "nation-1",
            nations: { id: "nation-1", name: "Nation A" },
          }),
        ],
      }).client,
    );

    renderSettlementReadinessListPanel();

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    const link = await screen.findByRole("link", { name: "Amberhold" });
    expect(link).toHaveAttribute(
      "href",
      "/worlds/world-1/nations/nation-1/settlements/settlement-1",
    );
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

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    await user.click(
      await screen.findByRole("switch", {
        name: "Ready",
      }),
    );

    expect(clientFixture.readEqId).toHaveBeenCalledWith("id", "settlement-1");
    expect(clientFixture.readEqWorldId).toHaveBeenCalledWith(
      "nations.world_id",
      "world-1",
    );
    expect(clientFixture.update).toHaveBeenCalledWith(
      "set_settlement_readiness",
      {
        p_is_ready: true,
        p_settlement_id: "settlement-1",
      },
    );
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

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    await user.click(
      await screen.findByRole("switch", {
        name: "Ready",
      }),
    );

    expect(clientFixture.update).toHaveBeenCalledWith(
      "set_settlement_readiness",
      {
        p_is_ready: false,
        p_settlement_id: "settlement-1",
      },
    );
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

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    const switchControl = await screen.findByRole("switch", {
      name: "Ready",
    });

    expect(switchControl).toBeDisabled();

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

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    const switchControl = await screen.findByRole("switch", {
      name: "Ready",
    });

    expect(switchControl).toBeDisabled();
    expect(switchControl).toBeChecked();
    expect(screen.getAllByText("Auto-ready").length).toBeGreaterThan(0);

    await user.click(switchControl);

    expect(clientFixture.update).not.toHaveBeenCalled();
  });

  it("shows auto-ready controls for world admins", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClientFixture({
        settlementRows: [
          createSettlementRow({
            id: "settlement-1",
            name: "Amberhold",
          }),
        ],
      }).client,
    );

    renderSettlementReadinessListPanel({
      accessContext: createWorldAdminAccessContext(),
    });

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    expect(
      await screen.findByRole("switch", { name: "Auto-ready" }),
    ).toBeDefined();
  });

  it("shows auto-ready controls for super admins", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClientFixture({
        settlementRows: [
          createSettlementRow({
            id: "settlement-1",
            name: "Amberhold",
          }),
        ],
      }).client,
    );

    renderSettlementReadinessListPanel({
      accessContext: createSuperAdminAccessContext(),
    });

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    expect(
      await screen.findByRole("switch", { name: "Auto-ready" }),
    ).toBeDefined();
  });

  it("hides auto-ready controls from unauthorized users", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClientFixture({
        settlementRows: [
          createSettlementRow({
            id: "settlement-1",
            name: "Amberhold",
          }),
        ],
      }).client,
    );

    renderSettlementReadinessListPanel({
      accessContext: createUnauthorizedAccessContext(),
      canAdmin: false,
      canManage: false,
    });

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    expect(await screen.findByText("Amberhold")).toBeDefined();
    expect(screen.queryByRole("switch", { name: "Auto-ready" })).toBeNull();
  });

  it("hides manual readiness switch for read-only users", async () => {
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

    renderSettlementReadinessListPanel({
      accessContext: createUnauthorizedAccessContext(),
      canAdmin: false,
      canManage: false,
    });

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    expect(await screen.findByText("Amberhold")).toBeDefined();
    expect(screen.queryByRole("switch", { name: "Ready" })).toBeNull();
    expect(screen.queryByRole("switch", { name: "Ready" })).toBeNull();

    await user.click(document.body);

    expect(clientFixture.update).not.toHaveBeenCalled();
  });

  it("shows read-only readiness indicator for read-only users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClientFixture({
        settlementRows: [
          createSettlementRow({
            id: "settlement-1",
            is_ready_current_turn: true,
            name: "Amberhold",
            ready_set_at: "2026-05-02T12:00:00.000Z",
          }),
          createSettlementRow({
            id: "settlement-2",
            name: "Briarwatch",
          }),
          createSettlementRow({
            auto_ready_enabled: true,
            id: "settlement-3",
            name: "Cinderford",
          }),
        ],
      }).client,
    );

    renderSettlementReadinessListPanel({
      accessContext: createUnauthorizedAccessContext(),
      canAdmin: false,
      canManage: false,
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    expect(await screen.findByText("Amberhold")).toBeDefined();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getByLabelText("Ready")).toBeDefined();
    expect(screen.getByLabelText("Ready")).toBeDefined();
    expect(screen.getByLabelText("Auto-ready")).toBeDefined();
  });

  it("shows manual readiness switch for managers without admin access", async () => {
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

    // canAdmin: false hides auto-ready; canManage: true shows manual switch.
    // Access context must have actual manage access so the mutation succeeds.
    renderSettlementReadinessListPanel({
      accessContext: createAdminAccessContext(),
      canAdmin: false,
      canManage: true,
    });

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    await user.click(await screen.findByRole("switch", { name: "Ready" }));

    expect(clientFixture.update).toHaveBeenCalledWith(
      "set_settlement_readiness",
      {
        p_is_ready: true,
        p_settlement_id: "settlement-1",
      },
    );
    expect(screen.queryByRole("switch", { name: "Auto-ready" })).toBeNull();
  });

  it("disables auto-ready controls for archived worlds", async () => {
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

    renderSettlementReadinessListPanel({
      accessContext: createWorldAdminAccessContext(),
      isArchived: true,
    });

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    const switchControl = await screen.findByRole("switch", {
      name: "Auto-ready",
    });

    expect(switchControl).toBeDisabled();

    await user.click(switchControl);

    expect(clientFixture.update).not.toHaveBeenCalled();
  });

  it("enables auto-ready through the auto-ready mutation", async () => {
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
          auto_ready_enabled: true,
          id: "settlement-1",
          is_ready_current_turn: false,
          ready_set_at: null,
        },
        error: null,
      },
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderSettlementReadinessListPanel({
      accessContext: createWorldAdminAccessContext(),
    });

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    await user.click(
      await screen.findByRole("switch", {
        name: "Auto-ready",
      }),
    );

    expect(clientFixture.readEqId).toHaveBeenCalledWith("id", "settlement-1");
    expect(clientFixture.readEqWorldId).toHaveBeenCalledWith(
      "nations.world_id",
      "world-1",
    );
    expect(clientFixture.update).toHaveBeenCalledWith(
      "set_settlement_auto_ready",
      {
        p_auto_ready_enabled: true,
        p_settlement_id: "settlement-1",
      },
    );
  });

  it("disables auto-ready through the auto-ready mutation", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({
          auto_ready_enabled: true,
          id: "settlement-1",
          name: "Amberhold",
        }),
      ],
      updateResult: {
        data: {
          auto_ready_enabled: false,
          id: "settlement-1",
          is_ready_current_turn: true,
          ready_set_at: "2026-05-02T12:00:00.000Z",
        },
        error: null,
      },
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderSettlementReadinessListPanel({
      accessContext: createSuperAdminAccessContext(),
    });

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    await user.click(
      await screen.findByRole("switch", {
        name: "Auto-ready",
      }),
    );

    expect(clientFixture.update).toHaveBeenCalledWith(
      "set_settlement_auto_ready",
      {
        p_auto_ready_enabled: false,
        p_settlement_id: "settlement-1",
      },
    );
  });

  it("emits an error toast when the readiness mutation fails", async () => {
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

    await user.click(await screen.findByRole("button", { name: /Nation A/ }));
    await user.click(
      await screen.findByRole("switch", {
        name: "Ready",
      }),
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("permission denied for table settlements"),
      );
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  describe("nation accordion grouping", () => {
    it("shows one accordion row per nation with ready/total counts and percentage", async () => {
      const user = userEvent.setup();
      requireSupabaseClient.mockReturnValue(
        createClientFixture({
          settlementRows: [
            createSettlementRow({
              id: "s1",
              is_ready_current_turn: true,
              name: "Amberhold",
              nation_id: "nation-1",
              nations: { id: "nation-1", name: "Ironhaven" },
              ready_set_at: "2026-05-02T12:00:00.000Z",
            }),
            createSettlementRow({
              id: "s2",
              name: "Briarwatch",
              nation_id: "nation-1",
              nations: { id: "nation-1", name: "Ironhaven" },
            }),
            createSettlementRow({
              id: "s3",
              name: "Cinderford",
              nation_id: "nation-2",
              nations: { id: "nation-2", name: "Stormkeep" },
            }),
          ],
        }).client,
      );

      renderSettlementReadinessListPanel();

      expect(
        await screen.findByRole("heading", {
          name: "Readiness Summary",
        }),
      ).toBeDefined();

      // Nation triggers appear without expanding
      expect(screen.getByText("Ironhaven")).toBeDefined();
      expect(screen.getByText("Stormkeep")).toBeDefined();

      // Nations sort alphabetically: Ironhaven before Stormkeep
      const [firstTrigger, secondTrigger] = screen.getAllByRole("button", {
        name: /ready/i,
      });
      expect(firstTrigger).toHaveTextContent("Ironhaven");
      expect(firstTrigger).toHaveTextContent("1/2 ready");
      expect(firstTrigger).toHaveTextContent("50%");
      expect(secondTrigger).toHaveTextContent("Stormkeep");
      expect(secondTrigger).toHaveTextContent("0/1 ready");
      expect(secondTrigger).toHaveTextContent("0%");

      // Expand Ironhaven and verify its settlements appear
      await user.click(firstTrigger);
      expect(await screen.findByText("Amberhold")).toBeDefined();
      expect(screen.getByText("Briarwatch")).toBeDefined();
    });

    it("shows the empty state when there are 0 settlements", async () => {
      requireSupabaseClient.mockReturnValue(
        createClientFixture({ settlementRows: [] }).client,
      );

      renderSettlementReadinessListPanel();

      expect(await screen.findByText("No settlements yet")).toBeDefined();
    });

    it("shows 100% in the summary for an all-ready nation", async () => {
      requireSupabaseClient.mockReturnValue(
        createClientFixture({
          settlementRows: [
            createSettlementRow({
              auto_ready_enabled: true,
              id: "s1",
              name: "Amberhold",
              nation_id: "nation-1",
              nations: { id: "nation-1", name: "Ironhaven" },
            }),
            createSettlementRow({
              id: "s2",
              is_ready_current_turn: true,
              name: "Briarwatch",
              nation_id: "nation-1",
              nations: { id: "nation-1", name: "Ironhaven" },
              ready_set_at: "2026-05-02T12:00:00.000Z",
            }),
          ],
        }).client,
      );

      renderSettlementReadinessListPanel();

      const trigger = await screen.findByRole("button", {
        name: /Ironhaven/,
      });
      expect(trigger).toHaveTextContent("2/2 ready");
      expect(trigger).toHaveTextContent("100%");
    });

    it("shows 0% in the summary for a none-ready nation", async () => {
      requireSupabaseClient.mockReturnValue(
        createClientFixture({
          settlementRows: [
            createSettlementRow({
              id: "s1",
              name: "Amberhold",
              nation_id: "nation-1",
              nations: { id: "nation-1", name: "Ironhaven" },
            }),
            createSettlementRow({
              id: "s2",
              name: "Briarwatch",
              nation_id: "nation-1",
              nations: { id: "nation-1", name: "Ironhaven" },
            }),
          ],
        }).client,
      );

      renderSettlementReadinessListPanel();

      const trigger = await screen.findByRole("button", {
        name: /Ironhaven/,
      });
      expect(trigger).toHaveTextContent("0/2 ready");
      expect(trigger).toHaveTextContent("0%");
    });

    it("renders nations alphabetically regardless of readiness mix", async () => {
      requireSupabaseClient.mockReturnValue(
        createClientFixture({
          settlementRows: [
            createSettlementRow({
              id: "s1",
              is_ready_current_turn: true,
              name: "Amberhold",
              nation_id: "nation-3",
              nations: { id: "nation-3", name: "Thornveil" },
              ready_set_at: "2026-05-02T12:00:00.000Z",
            }),
            createSettlementRow({
              id: "s2",
              name: "Briarwatch",
              nation_id: "nation-1",
              nations: { id: "nation-1", name: "Ashford" },
            }),
            createSettlementRow({
              id: "s3",
              is_ready_current_turn: true,
              name: "Cinderford",
              nation_id: "nation-2",
              nations: { id: "nation-2", name: "Mirewood" },
              ready_set_at: "2026-05-02T12:00:00.000Z",
            }),
          ],
        }).client,
      );

      renderSettlementReadinessListPanel();

      const triggers = await screen.findAllByRole("button", { name: /ready/i });
      expect(triggers[0]).toHaveTextContent("Ashford");
      expect(triggers[1]).toHaveTextContent("Mirewood");
      expect(triggers[2]).toHaveTextContent("Thornveil");
    });
  });
});

function renderSettlementReadinessListPanel({
  accessContext = createAdminAccessContext(),
  canAdmin = true,
  canManage = true,
  isArchived = false,
}: {
  readonly accessContext?: WorldPermissionContext;
  readonly canAdmin?: boolean;
  readonly canManage?: boolean;
  readonly isArchived?: boolean;
} = {}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SettlementReadinessListPanel
        accessContext={accessContext}
        canAdmin={canAdmin}
        canManage={canManage}
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
  readonly last_ready_at: string | null;
  readonly name: string;
  readonly nation_id: string;
  readonly nations: { readonly id: string; readonly name: string };
  readonly ready_set_at: string | null;
};
type TestSettlementReadinessAccessRow = {
  readonly id: string;
  readonly nations: {
    readonly world_id: string;
    readonly worlds: {
      readonly archived_at: string | null;
      readonly id: string;
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
type TestSettlementAutoReadyUpdateRow = {
  readonly auto_ready_enabled: boolean;
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
    last_ready_at: null,
    name: "Settlement",
    nation_id: "nation-1",
    nations: { id: "nation-1", name: "Nation A" },
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
  readonly updateResult?: TestSupabaseResult<
    TestSettlementAutoReadyUpdateRow | TestSettlementReadinessUpdateRow
  >;
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
  const rpcMaybeSingle = vi.fn().mockResolvedValue(updateResult);
  const rpc = vi.fn(() => ({ maybeSingle: rpcMaybeSingle }));
  const client = {
    from: vi.fn((table: string) => {
      if (table === "settlements") {
        return settlementsBuilder.builder;
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    rpc,
  };

  return {
    client,
    readEqId: settlementsBuilder.readEqId,
    readEqWorldId: settlementsBuilder.readEqWorldId,
    update: rpc,
    updateEq: rpc,
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
    rpc: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
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
  readonly updateResult: TestSupabaseResult<
    TestSettlementAutoReadyUpdateRow | TestSettlementReadinessUpdateRow
  >;
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

function expectSettlementRow(settlementName: string): void {
  const nameCell = screen.getByText(settlementName);
  const row = nameCell.closest("tr");

  expect(row).not.toBeNull();
}

function createAccessRow(): TestSettlementReadinessAccessRow {
  return {
    id: "settlement-1",
    nations: {
      world_id: "world-1",
      worlds: {
        archived_at: null,
        id: "world-1",
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
    worldAdminWorldIds: ["world-1"],
  });
}

function createWorldAdminAccessContext(): WorldPermissionContext {
  return createAccessContext({
    isSuperAdmin: false,
    userId: "user-2",
    worldAdminWorldIds: ["world-1"],
  });
}

function createSuperAdminAccessContext(): WorldPermissionContext {
  return createAccessContext({
    isSuperAdmin: true,
    userId: "user-2",
    worldAdminWorldIds: [],
  });
}

function createUnauthorizedAccessContext(): WorldPermissionContext {
  return createAccessContext({
    isSuperAdmin: false,
    userId: "user-2",
    worldAdminWorldIds: [],
  });
}
