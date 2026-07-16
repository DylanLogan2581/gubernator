import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CultureDetailPage } from "./CultureDetailPage";

import type { Culture } from "../types/cultureTypes";
import type { ReactNode } from "react";

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const CULTURE_ID = "00000000-0000-0000-0000-000000000002";

const { testState } = vi.hoisted(() => ({
  testState: {
    accessContext: {
      isActiveUser: true,
      isAuthenticated: true,
      userId: "00000000-0000-0000-0000-0000000000aa",
    },
    culture: null as Record<string, unknown> | null,
    updateMutationFn: vi.fn<(input: unknown) => Promise<unknown>>(),
    worldAccess: {
      canAdmin: true,
      header: { currentTurnNumber: 1, isArchived: false },
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    to,
  }: {
    readonly children: ReactNode;
    readonly params?: Readonly<Record<string, string>>;
    readonly to: string;
  }) => {
    const href =
      params === undefined
        ? to
        : Object.entries(params).reduce(
            (path, [name, value]) => path.replace(`$${name}`, value),
            to,
          );
    return <a href={href}>{children}</a>;
  },
  useBlocker: () => ({ status: "idle" as const }),
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
  isWorldNotFoundError: (error: unknown) =>
    error instanceof Error && error.message === "world-not-found",
  worldRouteAccessQueryOptions: () => ({
    queryFn: () => Promise.resolve(testState.worldAccess),
    queryKey: ["test", "world-access"],
  }),
}));

vi.mock("../queries/culturesQueries", () => ({
  cultureByIdQueryOptions: () => ({
    queryFn: () => Promise.resolve(testState.culture),
    queryKey: ["test", "culture"],
  }),
}));

vi.mock("../mutations/culturesMutations", () => ({
  updateCultureMutationOptions: () => ({
    mutationFn: (input: unknown) => testState.updateMutationFn(input),
    mutationKey: ["test", "update-culture"],
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("CultureDetailPage", () => {
  beforeEach(() => {
    testState.accessContext = {
      isActiveUser: true,
      isAuthenticated: true,
      userId: "00000000-0000-0000-0000-0000000000aa",
    };
    testState.worldAccess = {
      canAdmin: true,
      header: { currentTurnNumber: 1, isArchived: false },
    };
    testState.culture = createCultureRecord();
    testState.updateMutationFn.mockReset();
    testState.updateMutationFn.mockResolvedValue(createCultureRecord());
  });

  it("shows the culture name, color swatch, and description", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Coastal Folk" }),
    ).toBeDefined();
    expect(screen.getByText("A seafaring people.")).toBeDefined();
  });

  it("shows an access-denied state when the culture belongs to another world", async () => {
    testState.culture = createCultureRecord({ worldId: "other-world" });

    renderPage();

    expect(await screen.findByText("Culture unavailable")).toBeDefined();
  });

  it("allows an admin to edit and save a lore field", async () => {
    const user = userEvent.setup();
    renderPage();

    const saveButton = await screen.findByRole("button", {
      name: "Save changes",
    });
    expect(saveButton).toBeDisabled();

    const originsField = screen.getByLabelText("Origins");
    await user.type(originsField, "From the northern steppes.");
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    await waitFor(() => {
      expect(testState.updateMutationFn).toHaveBeenCalledWith(
        expect.objectContaining({
          cultureId: CULTURE_ID,
          origins: "From the northern steppes.",
          worldId: WORLD_ID,
        }),
      );
    });
  });

  it("renders lore fields as read-only for non-admins", async () => {
    testState.worldAccess = {
      canAdmin: false,
      header: { currentTurnNumber: 1, isArchived: false },
    };

    renderPage();

    const originsField = await screen.findByLabelText("Origins");
    expect(originsField).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("renders lore fields as read-only when the world is archived", async () => {
    testState.worldAccess = {
      canAdmin: true,
      header: { currentTurnNumber: 1, isArchived: true },
    };

    renderPage();

    const originsField = await screen.findByLabelText("Origins");
    expect(originsField).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});

function renderPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <CultureDetailPage cultureId={CULTURE_ID} worldId={WORLD_ID} />
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

function createCultureRecord(
  overrides: Partial<Record<string, unknown>> = {},
): Culture {
  return {
    architectureCraftsmanship: null,
    artsAesthetics: null,
    attitudesToOutsiders: null,
    color: "#6b7280",
    coreValues: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    cuisineMeals: null,
    demonym: null,
    description: "A seafaring people.",
    dressFashion: null,
    etiquette: null,
    festivalsHolidays: null,
    funeraryCustoms: null,
    genderFamilyNorms: null,
    id: CULTURE_ID,
    languageDialects: null,
    leadershipOccupations: null,
    name: "Coastal Folk",
    namingConventions: null,
    origins: null,
    ritesOfPassage: null,
    sayingsIdioms: null,
    socialHierarchy: null,
    superstitionsFolklore: null,
    taboos: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    worldId: WORLD_ID,
    ...overrides,
  };
}
