import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReligionDetailPage } from "./ReligionDetailPage";

import type { Religion } from "../types/religionTypes";
import type { ReactNode } from "react";

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const RELIGION_ID = "00000000-0000-0000-0000-000000000002";

const { testState } = vi.hoisted(() => ({
  testState: {
    accessContext: {
      isActiveUser: true,
      isAuthenticated: true,
      userId: "00000000-0000-0000-0000-0000000000aa",
    },
    religion: null as Record<string, unknown> | null,
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

vi.mock("../queries/religionsQueries", () => ({
  religionByIdQueryOptions: () => ({
    queryFn: () => Promise.resolve(testState.religion),
    queryKey: ["test", "religion"],
  }),
}));

vi.mock("../mutations/religionsMutations", () => ({
  updateReligionMutationOptions: () => ({
    mutationFn: (input: unknown) => testState.updateMutationFn(input),
    mutationKey: ["test", "update-religion"],
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("ReligionDetailPage", () => {
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
    testState.religion = createReligionRecord();
    testState.updateMutationFn.mockReset();
    testState.updateMutationFn.mockResolvedValue(createReligionRecord());
  });

  it("shows the religion name, color swatch, and description", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Sun Cult" }),
    ).toBeDefined();
    expect(screen.getByText("Worship of the sun.")).toBeDefined();
  });

  it("shows an access-denied state when the religion belongs to another world", async () => {
    testState.religion = createReligionRecord({ worldId: "other-world" });

    renderPage();

    expect(await screen.findByText("Religion unavailable")).toBeDefined();
  });

  it("allows an admin to edit and save a lore field", async () => {
    const user = userEvent.setup();
    renderPage();

    const saveButton = await screen.findByRole("button", {
      name: "Save changes",
    });
    expect(saveButton).toBeDisabled();

    const deitiesField = screen.getByLabelText("Deities");
    await user.type(deitiesField, "The Sunmother.");
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    await waitFor(() => {
      expect(testState.updateMutationFn).toHaveBeenCalledWith(
        expect.objectContaining({
          deities: "The Sunmother.",
          religionId: RELIGION_ID,
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

    const deitiesField = await screen.findByLabelText("Deities");
    expect(deitiesField).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("renders lore fields as read-only when the world is archived", async () => {
    testState.worldAccess = {
      canAdmin: true,
      header: { currentTurnNumber: 1, isArchived: true },
    };

    renderPage();

    const deitiesField = await screen.findByLabelText("Deities");
    expect(deitiesField).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});

function renderPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ReligionDetailPage religionId={RELIGION_ID} worldId={WORLD_ID} />
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

function createReligionRecord(
  overrides: Partial<Record<string, unknown>> = {},
): Religion {
  return {
    afterlifeBeliefs: null,
    color: "#6b7280",
    createdAt: "2026-01-01T00:00:00.000Z",
    creationMyth: null,
    deities: null,
    description: "Worship of the sun.",
    ethicsSins: null,
    funeraryRites: null,
    hierarchyGovernance: null,
    historySpread: null,
    holyDaysFestivals: null,
    holySites: null,
    id: RELIGION_ID,
    mythology: null,
    name: "Sun Cult",
    pilgrimageDevotions: null,
    priesthood: null,
    relationshipToState: null,
    ritualsCeremonies: null,
    sacredTexts: null,
    sectsSchisms: null,
    symbolsVestments: null,
    taboos: null,
    tenets: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    virtues: null,
    worldId: WORLD_ID,
    worshipPractices: null,
    ...overrides,
  };
}
