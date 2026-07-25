import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NamesetEditPage } from "./NamesetEditPage";

// jsdom lacks pointer capture / scrollIntoView, which Radix Select needs.
/* eslint-disable @typescript-eslint/unbound-method */
Element.prototype.hasPointerCapture ??= function hasPointerCapture() {
  return false;
};
Element.prototype.setPointerCapture ??= function setPointerCapture() {};
Element.prototype.releasePointerCapture ??= function releasePointerCapture() {};
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
/* eslint-enable @typescript-eslint/unbound-method */

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const NAMESET_ID = "00000000-0000-0000-0000-000000000002";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const { navigateSpy } = vi.hoisted(() => ({
  navigateSpy: vi.fn<(options: unknown) => void>(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateSpy,
  Link: ({ children }: { readonly children?: unknown }) => <>{children}</>,
}));

const { testState } = vi.hoisted(() => ({
  testState: {
    accessContext: {
      isActiveUser: true,
      isAuthenticated: true,
      userId: "00000000-0000-0000-0000-0000000000aa",
    },
    worldAccess: {
      canAdmin: true,
      header: { currentTurnNumber: 1, isArchived: false },
    },
  },
}));

vi.mock("@/features/permissions", () => ({
  AdminPausedHint: () => null,
  currentAccessContextQueryOptions: () => ({
    queryFn: () => Promise.resolve(testState.accessContext),
    queryKey: ["test", "access-context"],
  }),
  useEffectiveCanAdmin: (canAdmin: boolean) => canAdmin,
}));

vi.mock("@/features/worlds", () => ({
  isWorldNotFoundError: () => false,
  worldRouteAccessQueryOptions: () => ({
    queryFn: () => Promise.resolve(testState.worldAccess),
    queryKey: ["test", "world-access"],
  }),
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

describe("NamesetEditPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    navigateSpy.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    testState.worldAccess = {
      canAdmin: true,
      header: { currentTurnNumber: 1, isArchived: false },
    };
  });

  it("edits a generated nameset's generator and saves changes", async () => {
    const user = userEvent.setup();
    const row = createNamesetRow({
      name: "20th Cent. English",
      config_json: {
        type: "generated",
        convention: "pool",
        parts: { nm2: ["Ada"] },
        patterns: {
          female_given: [["nm2"]],
          male_given: [["nm2"]],
          surname: [["nm2"]],
        },
      },
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        namesetRows: [row],
        updateResult: { data: row, error: null },
      }),
    );

    renderPage();

    await screen.findByRole("heading", { name: "Edit nameset" });
    const entriesField = screen.getByRole("textbox", {
      name: "Entries for nm2",
    });
    expect(entriesField).toHaveValue("Ada");
    expect(
      screen.getByRole("button", { name: "Delete list nm2" }),
    ).toBeDisabled();

    await user.clear(entriesField);
    await user.type(entriesField, "Ada\nAstrid");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Nameset saved.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/worlds/$worldId/configuration",
        search: { tab: "namesets" },
      }),
    );
  });

  it("shows an access-denied state when the nameset does not exist", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ namesetRows: [] }));

    renderPage();

    expect(await screen.findByText("Nameset unavailable")).toBeDefined();
  });

  it("denies editing when the viewer cannot administer the world", async () => {
    testState.worldAccess = {
      canAdmin: false,
      header: { currentTurnNumber: 1, isArchived: false },
    };
    requireSupabaseClient.mockReturnValue(
      createClient({ namesetRows: [createNamesetRow({ name: "Norse" })] }),
    );

    renderPage();

    expect(await screen.findByText("Editing unavailable")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Edit nameset" })).toBeNull();
  });
});

function renderPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <NamesetEditPage namesetId={NAMESET_ID} worldId={WORLD_ID} />
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

type TestNamesetConfigJson =
  | {
      readonly convention: string;
      readonly female_given_names: readonly string[];
      readonly male_given_names: readonly string[];
      readonly surnames: readonly string[];
    }
  | {
      readonly type: "generated";
      readonly convention: string;
      readonly parts: Readonly<Record<string, readonly string[]>>;
      readonly patterns: {
        readonly female_given: readonly (readonly string[])[];
        readonly male_given: readonly (readonly string[])[];
        readonly surname: readonly (readonly string[])[];
      };
    };

type TestNamesetRow = {
  readonly config_json: TestNamesetConfigJson;
  readonly created_at: string;
  readonly id: string;
  readonly is_default: boolean;
  readonly is_trashed: boolean;
  readonly name: string;
  readonly updated_at: string;
  readonly world_id: string;
};

function createNamesetRow(
  overrides: Partial<TestNamesetRow> = {},
): TestNamesetRow {
  return {
    config_json: {
      convention: "pool",
      female_given_names: [],
      male_given_names: [],
      surnames: [],
    },
    created_at: "2026-01-01T00:00:00.000Z",
    id: NAMESET_ID,
    is_default: false,
    is_trashed: false,
    name: "Test Nameset",
    updated_at: "2026-01-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

function createClient({
  namesetRows,
  updateResult = { data: createNamesetRow(), error: null },
}: {
  readonly namesetRows: readonly TestNamesetRow[];
  readonly updateResult?: {
    readonly data: TestNamesetRow | null;
    readonly error: { readonly message: string } | null;
  };
}): { readonly from: ReturnType<typeof vi.fn> } {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn(() => Promise.resolve({ data: namesetRows, error: null })),
  };

  const updateBuilder: Record<string, unknown> = {
    eq: vi.fn(() => updateBuilder),
    select: vi.fn(() => ({
      maybeSingle: vi.fn().mockResolvedValue(updateResult),
    })),
  };

  return {
    from: vi.fn((table: string) => {
      if (table !== "namesets") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        select: vi.fn(() => selectBuilder),
        update: vi.fn(() => updateBuilder),
      };
    }),
  };
}
