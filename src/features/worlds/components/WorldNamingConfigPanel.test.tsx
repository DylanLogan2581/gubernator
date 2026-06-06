import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAccessContext,
  type AccessContext,
} from "@/features/permissions";
import type { WorldNamingConfig } from "@/lib/worldNamingConfigSchemas";

import { WorldNamingConfigPanel } from "./WorldNamingConfigPanel";

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

describe("WorldNamingConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("emits a success toast after saving the naming config", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({ worldRows: [createWorldRow()] }),
    );

    renderPanel({
      accessContext: createAccessContext({
        isSuperAdmin: false,
        userId: "user-1",
        worldAdminWorldIds: [WORLD_ID],
      }),
      canAdmin: true,
      isArchived: false,
    });

    await screen.findByRole("heading", { name: "Naming rules" });
    await user.click(screen.getByRole("button", { name: "Save naming rules" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Naming configuration saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("emits an error toast when saving the naming config fails", async () => {
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
        worldAdminWorldIds: [WORLD_ID],
      }),
      canAdmin: true,
      isArchived: false,
    });

    await screen.findByRole("heading", { name: "Naming rules" });
    await user.click(screen.getByRole("button", { name: "Save naming rules" }));

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
      await screen.findByRole("heading", { name: "Naming rules" }),
    ).toBeDefined();
    expect(screen.getByText("Read-only")).toBeDefined();
    expect(
      screen.queryByRole("button", { name: "Save naming rules" }),
    ).toBeNull();
  });

  it("shows empty pool warning when convention is not manual and male pool is empty", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        worldRows: [
          createWorldRow({
            naming_config_json: createNamingConfig({ male_given_names: [] }),
          }),
        ],
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

    await screen.findByRole("heading", { name: "Naming rules" });
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("shows empty pool warning when convention is not manual and female pool is empty", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        worldRows: [
          createWorldRow({
            naming_config_json: createNamingConfig({ female_given_names: [] }),
          }),
        ],
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

    await screen.findByRole("heading", { name: "Naming rules" });
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("does not show empty pool warning when convention is manual", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        worldRows: [
          createWorldRow({
            naming_config_json: createNamingConfig({
              convention: "manual",
              female_given_names: [],
              male_given_names: [],
            }),
          }),
        ],
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

    await screen.findByRole("heading", { name: "Naming rules" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders Manual only as a radio option, not a checkbox", async () => {
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

    await screen.findByRole("heading", { name: "Naming rules" });

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("radio", { name: /Manual only/i })).toBeDefined();
  });

  it("selecting Manual only suppresses the empty pool warning", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        worldRows: [
          createWorldRow({
            naming_config_json: createNamingConfig({
              female_given_names: [],
              male_given_names: [],
            }),
          }),
        ],
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

    await screen.findByRole("heading", { name: "Naming rules" });
    expect(screen.getByRole("alert")).toBeDefined();

    await user.click(screen.getByRole("radio", { name: /Manual only/i }));

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("drops blank-on-add rows from name pools when saving", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({ worldRows: [createWorldRow()] }),
    );

    renderPanel({
      accessContext: createAccessContext({
        isSuperAdmin: false,
        userId: "user-1",
        worldAdminWorldIds: [WORLD_ID],
      }),
      canAdmin: true,
      isArchived: false,
    });

    await screen.findByRole("heading", { name: "Naming rules" });

    expect(screen.getAllByRole("textbox")).toHaveLength(2);

    const [maleAddEntryButton] = screen.getAllByRole("button", {
      name: "Add entry",
    });
    if (maleAddEntryButton === undefined) {
      throw new Error("expected at least one Add entry button");
    }
    await user.click(maleAddEntryButton);

    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    expect(screen.getAllByDisplayValue("")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Save naming rules" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Naming configuration saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();

    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.queryAllByDisplayValue("")).toHaveLength(0);
    expect(screen.getByDisplayValue("Bob")).toBeDefined();
    expect(screen.getByDisplayValue("Alice")).toBeDefined();
  });

  it("does not show empty pool warning when both pools have entries", async () => {
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

    await screen.findByRole("heading", { name: "Naming rules" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not reserve warning space when both pools have entries", async () => {
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

    await screen.findByRole("heading", { name: "Naming rules" });
    const form = screen.getByRole("form", {
      name: "World naming configuration",
    });
    expect(form.firstElementChild?.tagName).toBe("FIELDSET");
  });

  it("keeps the male pool fieldset position stable when toggling convention with an empty pool", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        worldRows: [
          createWorldRow({
            naming_config_json: createNamingConfig({ male_given_names: [] }),
          }),
        ],
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

    await screen.findByRole("heading", { name: "Naming rules" });
    const form = screen.getByRole("form", {
      name: "World naming configuration",
    });
    const firstChildBefore = form.firstElementChild;
    expect(screen.getByRole("alert")).toBeDefined();

    await user.click(screen.getByRole("radio", { name: /Manual only/i }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(form.firstElementChild).toBe(firstChildBefore);
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
      <WorldNamingConfigPanel
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
  readonly id: string;
  readonly naming_config_json: WorldNamingConfig;
  readonly status: string;
  readonly visibility: string;
};

function createWorldRow(overrides: Partial<TestWorldRow> = {}): TestWorldRow {
  return {
    archived_at: null,
    id: WORLD_ID,
    naming_config_json: createNamingConfig(),
    status: "active",
    visibility: "private",
    ...overrides,
  };
}

function createNamingConfig(
  overrides: Partial<WorldNamingConfig> = {},
): WorldNamingConfig {
  return {
    convention: "random",
    female_given_names: ["Alice"],
    male_given_names: ["Bob"],
    surnames: [],
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
