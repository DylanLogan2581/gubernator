import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as CitizensModule from "@/features/citizens";
import type { ActivePlayerCharacterContextValue } from "@/features/permissions";

import { DecreesSection, type DecreesSectionProps } from "./DecreesSection";

const NATION_ID = "nation-1";
const WORLD_ID = "world-1";

const issueDecreeMutationFn = vi.fn<(input: unknown) => Promise<void>>(() =>
  Promise.resolve(),
);

vi.mock("../mutations/decreesMutations", () => ({
  issueDecreeMutationOptions: () => ({
    mutationFn: issueDecreeMutationFn,
  }),
  revokeDecreeMutationOptions: () => ({
    mutationFn: () => Promise.resolve(),
  }),
}));

vi.mock("../queries/decreesQueries", () => ({
  DECREES_PAGE_SIZE: 20,
  nationDecreesQueryOptions: () => ({
    queryFn: () => Promise.resolve({ decrees: [], totalCount: 0 }),
    queryKey: ["nation-decrees"],
  }),
  settlementDecreesQueryOptions: () => ({
    queryFn: () => Promise.resolve({ decrees: [], totalCount: 0 }),
    queryKey: ["settlement-decrees"],
  }),
}));

vi.mock("@/features/calendar", async () => {
  const actual = await vi.importActual("@/features/calendar");
  return {
    ...actual,
    worldCalendarConfigQueryOptions: () => ({
      queryFn: () => Promise.resolve(null),
      queryKey: ["world-calendar-config"],
    }),
  };
});

vi.mock("@/features/citizens", async () => {
  const actual = await vi.importActual<typeof CitizensModule>(
    "@/features/citizens",
  );
  return {
    ...actual,
    citizensInSettlementQueryOptions: () => ({
      queryFn: () => Promise.resolve([]),
      queryKey: ["citizens-in-settlement"],
    }),
    playerCharactersInNationQueryOptions: () => ({
      queryFn: () => Promise.resolve([]),
      queryKey: ["player-characters-in-nation"],
    }),
  };
});

vi.mock("@/features/citizens/queries/citizensQueries", async () => {
  const actual = await vi.importActual(
    "@/features/citizens/queries/citizensQueries",
  );
  return {
    ...actual,
    citizenByIdQueryOptions: (citizenId: string) => ({
      queryFn: () =>
        Promise.resolve(
          citizenId === "citizen-picked"
            ? { id: citizenId, name: "Carol" }
            : null,
        ),
      queryKey: ["citizen-by-id", citizenId],
    }),
  };
});

vi.mock("@/features/citizens/queries/citizenDirectoryQueries", async () => {
  const actual = await vi.importActual(
    "@/features/citizens/queries/citizenDirectoryQueries",
  );
  return {
    ...actual,
    citizensDirectoryQueryOptions: () => ({
      queryFn: () =>
        Promise.resolve({
          rows: [{ id: "citizen-picked", name: "Carol" }],
          totalCount: 1,
        }),
      queryKey: ["citizens-directory"],
    }),
  };
});

const { useActivePlayerCharacterMock } = vi.hoisted(() => ({
  useActivePlayerCharacterMock: vi.fn<() => ActivePlayerCharacterContextValue>(
    () => ({
      activeCharacter: null,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    }),
  ),
}));

vi.mock("@/features/permissions", async () => {
  const actual = await vi.importActual("@/features/permissions");
  return {
    ...actual,
    useActivePlayerCharacter: useActivePlayerCharacterMock,
  };
});

describe("DecreesSection", () => {
  beforeEach(() => {
    issueDecreeMutationFn.mockClear();
    useActivePlayerCharacterMock.mockReset();
    useActivePlayerCharacterMock.mockReturnValue({
      activeCharacter: null,
      clear: vi.fn(),
      isPending: false,
      selectableCharacters: [],
      switchTo: vi.fn(),
    });
  });

  it("lets a superadmin issue a decree via a citizen picker when no manager resolves", async () => {
    const user = userEvent.setup();
    renderSection({ canManage: true, effectiveCanAdmin: true });

    const issueButton = await screen.findByRole("button", {
      name: "Issue decree",
    });
    await user.click(issueButton);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Carol"));

    await user.type(screen.getByLabelText("Title"), "New tax");
    await user.type(screen.getByLabelText("Body"), "All citizens pay more.");

    await user.click(screen.getByRole("button", { name: "Issue decree" }));

    await waitFor(() => {
      expect(issueDecreeMutationFn).toHaveBeenCalledWith(
        expect.objectContaining({ issuedByCitizenId: "citizen-picked" }),
        expect.anything(),
      );
    });
  });

  it("keeps the issue button hidden for non-privileged users with no manager", async () => {
    renderSection({ canManage: false, effectiveCanAdmin: false });

    await screen.findByText("Decrees");
    expect(
      screen.queryByRole("button", { name: "Issue decree" }),
    ).not.toBeInTheDocument();
  });
});

function renderSection(
  overrides: Partial<
    Pick<DecreesSectionProps, "canManage" | "effectiveCanAdmin">
  >,
): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const props: DecreesSectionProps = {
    canManage: false,
    effectiveCanAdmin: false,
    isArchived: false,
    nationId: NATION_ID,
    scope: "nation",
    worldId: WORLD_ID,
    ...overrides,
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <DecreesSection {...props} />
    </QueryClientProvider>,
  );
}
