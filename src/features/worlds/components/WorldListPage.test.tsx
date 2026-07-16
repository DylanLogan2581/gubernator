import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { WorldCalendarConfig } from "@/features/calendar";

import { writeWorldScopePin } from "../utils/worldScopePin";

import { WorldListPage } from "./WorldListPage";

import type { ReactNode } from "react";

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

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    to,
  }: {
    readonly children: ReactNode;
    readonly params?: Record<string, string>;
    readonly to: string;
  }) => {
    const href =
      params === undefined
        ? to
        : Object.entries(params).reduce(
            (acc, [key, value]) => acc.replace(`$${key}`, value),
            to,
          );
    return <a href={href}>{children}</a>;
  },
}));

describe("WorldListPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    localStorage.clear();
  });

  it("renders the world list loading state", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: new Promise(() => undefined),
      }),
    );

    renderWorldListPage();

    expect(
      await screen.findByRole("status", { name: "Loading worlds…" }),
    ).toBeDefined();
  });

  it("renders a skeleton while access context is pending", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [],
        getSessionOverride: () => new Promise(() => undefined),
      }),
    );

    renderWorldListPage();

    expect(
      await screen.findByRole("status", { name: "Loading list" }),
    ).toBeDefined();
  });

  it("shows a retryable error state when access context fails to load", async () => {
    const user = userEvent.setup();
    let getSessionCallCount = 0;
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [],
        getSessionOverride: () => {
          getSessionCallCount += 1;
          if (getSessionCallCount === 1) {
            return Promise.reject(new Error("network unreachable"));
          }
          return Promise.resolve({
            data: { session: { user: { id: "user-1" } } },
            error: null,
          });
        },
      }),
    );

    renderWorldListPage();

    expect(
      await screen.findByText("World access could not be loaded"),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("No accessible worlds")).toBeDefined();
  });

  it("renders the no-access empty state", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [],
      }),
    );

    renderWorldListPage();

    expect(await screen.findByText("No accessible worlds")).toBeDefined();
    expect(
      screen.getByText(
        "Your Gubernator account does not currently have access to any worlds.",
      ),
    ).toBeDefined();
  });

  it("renders accessible worlds", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: "00000000-0000-0000-0000-000000000202" }],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000101",
            name: "Public World",
            visibility: "public",
          }),
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000202",
            name: "Private World",
            visibility: "private",
          }),
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000303",
            name: "Inaccessible World",
            visibility: "private",
          }),
        ],
      }),
    );

    renderWorldListPage();

    expect(await screen.findByText("Public World")).toBeDefined();
    expect(screen.getByText("Private World")).toBeDefined();
    expect(screen.queryByText("Inaccessible World")).toBeNull();
    expect(screen.getByRole("link", { name: /Public World/i })).toHaveAttribute(
      "href",
      "/worlds/00000000-0000-0000-0000-000000000101",
    );
  });

  it("uses a responsive card grid for the world list", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ name: "Grid World" })],
      }),
    );

    renderWorldListPage();

    await screen.findByText("Grid World");
    expect(screen.getByRole("list", { name: "Accessible worlds" })).toHaveClass(
      "sm:grid-cols-2",
      "lg:grid-cols-3",
    );
  });

  it("shows a resume link to the pinned nation when a scope pin is stored", async () => {
    const worldId = "00000000-0000-0000-0000-000000000501";
    writeWorldScopePin(worldId, { nationId: "nation-1", settlementId: null });
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ id: worldId, name: "Resume World" })],
      }),
    );

    renderWorldListPage();

    await screen.findByText("Resume World");
    expect(screen.getByRole("link", { name: "Resume" })).toHaveAttribute(
      "href",
      `/worlds/${worldId}/nations/nation-1`,
    );
  });

  it("shows a resume link to the pinned settlement when both nation and settlement are stored", async () => {
    const worldId = "00000000-0000-0000-0000-000000000502";
    writeWorldScopePin(worldId, {
      nationId: "nation-1",
      settlementId: "settlement-1",
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({ id: worldId, name: "Resume Settlement World" }),
        ],
      }),
    );

    renderWorldListPage();

    await screen.findByText("Resume Settlement World");
    expect(screen.getByRole("link", { name: "Resume" })).toHaveAttribute(
      "href",
      `/worlds/${worldId}/nations/nation-1/settlements/settlement-1`,
    );
  });

  it("does not show a resume link when no scope pin is stored", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ name: "No Pin World" })],
      }),
    );

    renderWorldListPage();

    await screen.findByText("No Pin World");
    expect(screen.queryByRole("link", { name: "Resume" })).toBeNull();
  });

  it("shows a world icon with the first letter of the world name", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000101",
            name: "Calendar World",
          }),
        ],
      }),
    );

    renderWorldListPage();

    expect(await screen.findByText("Calendar World")).toBeDefined();
    expect(screen.getByText("C")).toBeDefined();
  });

  it("shows a tooltip explaining the Hidden badge on hover", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        adminRows: [{ world_id: "00000000-0000-0000-0000-000000000202" }],
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            id: "00000000-0000-0000-0000-000000000202",
            name: "Private World",
            visibility: "private",
          }),
        ],
      }),
    );

    renderWorldListPage();

    const badge = await screen.findByText("Hidden");
    await user.hover(badge);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      /Hidden from players/i,
    );
  });

  it("renders planning turn and computed in-world date", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 3,
            name: "Calendar World",
          }),
        ],
      }),
    );

    renderWorldListPage();

    expect(await screen.findByText("Calendar World")).toBeDefined();
    expect(screen.getByText("Planning turn")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("In-world date")).toBeDefined();
    expect(screen.getByText("Firstday, Ember 1, 100 AG")).toBeDefined();
  });

  it("renders a safe fallback for missing or invalid calendar config", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        session: { user: { id: "user-1" } },
        worldRows: [
          createWorldRow({
            calendar_config_json: null,
            name: "Missing Calendar World",
          }),
          createWorldRow({
            calendar_config_json: { months: [] },
            id: "00000000-0000-0000-0000-000000000404",
            name: "Invalid Calendar World",
          }),
        ],
      }),
    );

    renderWorldListPage();

    expect(await screen.findByText("Missing Calendar World")).toBeDefined();
    expect(screen.getByText("Invalid Calendar World")).toBeDefined();
    expect(screen.getAllByText("Calendar unavailable")).toHaveLength(2);
  });

  it("shows confirm dialog when move to trash button is clicked", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        isSuperAdmin: true,
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ name: "Test World" })],
      }),
    );

    renderWorldListPage();

    await screen.findByText("Test World");
    await user.click(
      screen.getByRole("button", { name: "Move Test World to trash" }),
    );

    expect(
      await screen.findByRole("alertdialog", {
        name: "Move Test World to trash?",
      }),
    ).toBeDefined();
  });

  it("does not call trash mutation when cancel is clicked", async () => {
    const user = userEvent.setup();
    const rpcSpy = vi.fn((fn: string) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: [], error: null });
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        isSuperAdmin: true,
        rpcOverride: rpcSpy,
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ name: "Test World" })],
      }),
    );

    renderWorldListPage();

    await screen.findByText("Test World");
    await user.click(
      screen.getByRole("button", { name: "Move Test World to trash" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Move Test World to trash?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("alertdialog", {
          name: "Move Test World to trash?",
        }),
      ).toBeNull();
    });

    expect(rpcSpy).not.toHaveBeenCalledWith("trash_world", expect.anything());
  });

  it("calls trash rpc and shows success toast when dialog is confirmed", async () => {
    const user = userEvent.setup();
    const worldId = "00000000-0000-0000-0000-000000000001";
    const rpcSpy = vi.fn((fn: string) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: [], error: null });
      }
      if (fn === "trash_world") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: worldId },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        isSuperAdmin: true,
        rpcOverride: rpcSpy,
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ id: worldId, name: "Test World" })],
      }),
    );

    renderWorldListPage();

    await screen.findByText("Test World");
    await user.click(
      screen.getByRole("button", { name: "Move Test World to trash" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Move Test World to trash?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Move to trash" }),
    );

    await waitFor(() => {
      expect(rpcSpy).toHaveBeenCalledWith("trash_world", {
        p_world_id: worldId,
      });
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "World moved to trash.",
        undefined,
      );
    });
  });

  it("shows a note linking to the superadmin worlds panel and no hard-delete button in the trash view", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        isSuperAdmin: true,
        session: { user: { id: "user-1" } },
        worldRows: [],
        trashedWorldRows: [
          createWorldRow({ name: "Trashed World", is_trashed: true }),
        ],
      }),
    );

    renderWorldListPage();

    await screen.findByText("No accessible worlds");
    const trashToggle = screen.getByRole("button", { name: "Trash" });
    expect(trashToggle).toHaveAttribute("aria-pressed", "false");
    await user.click(trashToggle);
    await screen.findByText("Trashed World");

    expect(
      screen.getByText("Permanent deletion happens in", { exact: false }),
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: "the Superadmin area" }),
    ).toHaveAttribute("href", "/superadmin/worlds");
    expect(
      screen.queryByRole("button", { name: "Delete permanently" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Back to worlds" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles back to the active world list from the trash view", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        isSuperAdmin: true,
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ name: "Test World" })],
        trashedWorldRows: [
          createWorldRow({ name: "Trashed World", is_trashed: true }),
        ],
      }),
    );

    renderWorldListPage();

    await screen.findByText("Test World");
    await user.click(screen.getByRole("button", { name: "Trash" }));
    await screen.findByText("Trashed World");

    await user.click(screen.getByRole("button", { name: "Back to worlds" }));

    await screen.findByText("Test World");
    expect(screen.queryByText("Trashed World")).toBeNull();
  });

  it("toggles the trash view via keyboard activation", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        isSuperAdmin: true,
        session: { user: { id: "user-1" } },
        worldRows: [],
        trashedWorldRows: [
          createWorldRow({ name: "Trashed World", is_trashed: true }),
        ],
      }),
    );

    renderWorldListPage();

    await screen.findByText("No accessible worlds");
    const trashToggle = screen.getByRole("button", { name: "Trash" });
    trashToggle.focus();
    await user.keyboard("{Enter}");

    await screen.findByText("Trashed World");
  });

  it("auto-opens the create dialog when action is 'create' and clears it", async () => {
    const onClearAction = vi.fn();
    requireSupabaseClient.mockReturnValue(
      createClient({
        isSuperAdmin: true,
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ name: "Test World" })],
      }),
    );

    renderWorldListPage({ action: "create", onClearAction });

    await screen.findByText("Test World");
    expect(
      await screen.findByRole("dialog", { name: "Create world" }),
    ).toBeDefined();
    expect(onClearAction).toHaveBeenCalled();
  });

  it("opens the import file picker when action is 'import' and clears it", async () => {
    const onClearAction = vi.fn();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    requireSupabaseClient.mockReturnValue(
      createClient({
        isSuperAdmin: true,
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ name: "Test World" })],
      }),
    );

    renderWorldListPage({ action: "import", onClearAction });

    await screen.findByText("Test World");
    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
    expect(onClearAction).toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it("ignores the action param for non-superadmins", async () => {
    const onClearAction = vi.fn();
    requireSupabaseClient.mockReturnValue(
      createClient({
        isSuperAdmin: false,
        session: { user: { id: "user-1" } },
        worldRows: [createWorldRow({ name: "Test World" })],
      }),
    );

    renderWorldListPage({ action: "create", onClearAction });

    await screen.findByText("Test World");
    expect(screen.queryByText("Create world")).toBeNull();
    expect(onClearAction).not.toHaveBeenCalled();
  });

  it("restores a trashed world", async () => {
    const user = userEvent.setup();
    const worldId = "00000000-0000-0000-0000-000000000009";
    const rpcSpy = vi.fn((fn: string) => {
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: [], error: null });
      }
      if (fn === "restore_world") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: worldId },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        isSuperAdmin: true,
        rpcOverride: rpcSpy,
        session: { user: { id: "user-1" } },
        worldRows: [],
        trashedWorldRows: [
          createWorldRow({
            id: worldId,
            name: "Trashed World",
            is_trashed: true,
          }),
        ],
      }),
    );

    renderWorldListPage();

    await screen.findByText("No accessible worlds");
    await user.click(screen.getByRole("button", { name: "Trash" }));
    await screen.findByText("Trashed World");
    await user.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => {
      expect(rpcSpy).toHaveBeenCalledWith("restore_world", {
        p_world_id: worldId,
      });
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("World restored.", undefined);
    });
  });
});

function renderWorldListPage({
  action,
  onClearAction,
}: {
  readonly action?: "create" | "import";
  readonly onClearAction?: () => void;
} = {}): void {
  render(
    <TooltipProvider>
      <QueryClientProvider client={createQueryClient()}>
        <WorldListPage action={action} onClearAction={onClearAction} />
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

function createClient({
  adminRows = [],
  getSessionOverride,
  isSuperAdmin = false,
  rpcOverride,
  session,
  worldRows = [],
  trashedWorldRows = [],
}: {
  readonly adminRows?: readonly { readonly world_id: string }[];
  readonly getSessionOverride?: () => Promise<unknown>;
  readonly isSuperAdmin?: boolean;
  readonly rpcOverride?: (fn: string, args: unknown) => unknown;
  readonly session: {
    readonly user: {
      readonly id: string;
    };
  };
  readonly worldRows?: Promise<unknown> | readonly TestWorldRow[];
  readonly trashedWorldRows?: readonly TestWorldRow[];
}): unknown {
  return {
    auth: {
      getSession:
        getSessionOverride ??
        vi.fn().mockResolvedValue({
          data: { session },
          error: null,
        }),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return createUsersQueryBuilder(
          createUser(session.user.id, isSuperAdmin),
        );
      }

      if (table === "world_admins") {
        return createWorldAdminsQueryBuilder(adminRows);
      }

      if (table === "worlds") {
        return createWorldsQueryBuilder(worldRows, trashedWorldRows);
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn((fn: string, args: unknown) => {
      if (rpcOverride !== undefined) {
        return rpcOverride(fn, args);
      }
      if (fn === "current_user_player_character_world_ids") {
        return Promise.resolve({ data: [], error: null });
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    }),
  };
}

type TestUser = {
  readonly created_at: string;
  readonly email: string;
  readonly id: string;
  readonly is_super_admin: boolean;
  readonly status: string;
  readonly updated_at: string;
  readonly username: string;
};

type TestWorldRow = {
  readonly archived_at: string | null;
  readonly calendar_config_json: TestCalendarConfigJson;
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
type TestCalendarConfigJson =
  | WorldCalendarConfig
  | { readonly months: [] }
  | null;

function createUser(id: string, isSuperAdmin = false): TestUser {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    email: `${id}@example.com`,
    id,
    is_super_admin: isSuperAdmin,
    status: "active",
    updated_at: "2026-01-01T00:00:00.000Z",
    username: id,
  };
}

function createWorldRow(overrides: Partial<TestWorldRow> = {}): TestWorldRow {
  return {
    archived_at: null,
    calendar_config_json: createCalendarConfig(),
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

function createCalendarConfig(): WorldCalendarConfig {
  return {
    months: [
      { dayCount: 2, index: 0, name: "Dawn" },
      { dayCount: 3, index: 1, name: "Ember" },
    ],
    startingDayOfMonth: 1,
    startingMonthIndex: 0,
    startingWeekdayOffset: 0,
    startingYear: 100,
    weekdays: [
      { index: 0, name: "Firstday" },
      { index: 1, name: "Secondday" },
    ],
    dateFormatTemplate: "{weekday}, {month} {day}, {year} AG",
    shortDateFormatTemplate: "{monthNumber}/{dayNumber}/{yearNumber}",
  };
}

function createUsersQueryBuilder(user: TestUser): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: user, error: null }),
      })),
    })),
  };
}

function createWorldAdminsQueryBuilder(
  rows: readonly { readonly world_id: string }[],
): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: rows, error: null }),
      })),
    })),
  };
}

function createWorldsQueryBuilder(
  rows: Promise<unknown> | readonly TestWorldRow[],
  trashedRows: readonly TestWorldRow[] = [],
): unknown {
  const activeResult =
    rows instanceof Promise
      ? rows
      : Promise.resolve({ data: rows, error: null });
  const trashedResult = Promise.resolve({ data: trashedRows, error: null });

  const eq = vi.fn((column: string, value: boolean) => {
    const result =
      column === "is_trashed" && value === true ? trashedResult : activeResult;
    return { order: vi.fn().mockReturnValue(result) };
  });
  return {
    select: vi.fn(() => ({ eq })),
  };
}
