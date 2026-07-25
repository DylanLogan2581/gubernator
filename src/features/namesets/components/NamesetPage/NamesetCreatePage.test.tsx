import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NamesetCreatePage } from "./NamesetCreatePage";

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

describe("NamesetCreatePage", () => {
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

  it("creates a generated nameset from the library with a live preview", async () => {
    const user = userEvent.setup();
    let insertedPayload: unknown;
    requireSupabaseClient.mockReturnValue(
      createClient({
        onInsert: (payload) => {
          insertedPayload = payload;
        },
      }),
    );

    renderPage();

    await screen.findByRole("heading", { name: "Create nameset" });
    await user.click(screen.getByRole("radio", { name: /Generated/ }));
    await user.click(screen.getByRole("radio", { name: /From library/ }));

    await user.type(
      screen.getByRole("textbox", { name: "Search name generators" }),
      "20th Cent",
    );
    await user.click(
      await screen.findByRole("button", { name: "20th Cent. English" }),
    );

    await screen.findByText("Preview");

    const createButton = screen.getByRole("button", { name: "Create" });
    await waitFor(() => {
      expect(createButton).toBeEnabled();
    });
    await user.click(createButton);

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Nameset created.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
    expect(insertedPayload).toMatchObject({
      name: "20th Cent. English",
      config_json: { type: "generated" },
    });
    expect(navigateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/worlds/$worldId/configuration",
        search: { tab: "namesets" },
      }),
    );
  });

  it("creates a generated nameset from scratch via the generator editor", async () => {
    const user = userEvent.setup();
    let insertedPayload: unknown;
    requireSupabaseClient.mockReturnValue(
      createClient({
        onInsert: (payload) => {
          insertedPayload = payload;
        },
      }),
    );

    renderPage();

    await screen.findByRole("heading", { name: "Create nameset" });
    await user.type(
      screen.getByRole("textbox", { name: "Nameset name" }),
      "Dwarven",
    );
    await user.click(screen.getByRole("radio", { name: /Generated/ }));
    await user.click(screen.getByRole("radio", { name: /From scratch/ }));

    await user.type(
      screen.getByRole("textbox", { name: "New list name" }),
      "onset",
    );
    await user.click(screen.getByRole("button", { name: "Add list" }));
    await user.type(
      screen.getByRole("textbox", { name: "Entries for onset" }),
      "Thor\nGrim",
    );

    const addListRefSelects = screen.getAllByRole("combobox", {
      name: "Add list reference",
    });
    await user.click(addListRefSelects[0]);
    await user.click(await screen.findByRole("option", { name: "onset" }));
    await user.click(addListRefSelects[1]);
    await user.click(await screen.findByRole("option", { name: "onset" }));

    await screen.findByText("Preview");

    const createButton = screen.getByRole("button", { name: "Create" });
    await waitFor(() => {
      expect(createButton).toBeEnabled();
    });
    await user.click(createButton);

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Nameset created.",
        undefined,
      );
    });
    expect(insertedPayload).toMatchObject({
      name: "Dwarven",
      config_json: {
        type: "generated",
        parts: { onset: ["Thor", "Grim"] },
        patterns: {
          female_given: [["onset"]],
          male_given: [["onset"]],
        },
      },
    });
  });

  it("shows an inline validation error when the name is empty", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({}));

    renderPage();

    await screen.findByRole("heading", { name: "Create nameset" });
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Name is required.")).toBeDefined();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("denies creation when the viewer cannot administer the world", async () => {
    testState.worldAccess = {
      canAdmin: false,
      header: { currentTurnNumber: 1, isArchived: false },
    };
    requireSupabaseClient.mockReturnValue(createClient({}));

    renderPage();

    expect(await screen.findByText("Creating unavailable")).toBeDefined();
    expect(
      screen.queryByRole("heading", { name: "Create nameset" }),
    ).toBeNull();
  });
});

function renderPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <NamesetCreatePage worldId={WORLD_ID} />
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
  onInsert,
  insertResult = {
    data: { id: NAMESET_ID, world_id: WORLD_ID },
    error: null,
  },
}: {
  readonly onInsert?: (payload: unknown) => void;
  readonly insertResult?: {
    readonly data: unknown;
    readonly error: { readonly message: string } | null;
  };
}): { readonly from: ReturnType<typeof vi.fn> } {
  return {
    from: vi.fn((table: string) => {
      if (table !== "namesets") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        insert: vi.fn((payload: unknown) => {
          onInsert?.(payload);
          return {
            select: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue(insertResult),
            })),
          };
        }),
      };
    }),
  };
}
