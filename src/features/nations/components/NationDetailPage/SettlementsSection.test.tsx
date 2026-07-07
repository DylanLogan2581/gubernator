import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorldPermissionContext } from "@/features/worlds";

import { NationSettlementsSection } from "./SettlementsSection";

import type { ReactNode } from "react";

const {
  mockNationSettlementsQuery,
  mockPlayerCharactersQuery,
  mockCreateSettlement,
  mockDeleteSettlement,
  mockSetReadiness,
  mockNotifySuccess,
  mockNotifyError,
} = vi.hoisted(() => ({
  mockNationSettlementsQuery: vi.fn(),
  mockPlayerCharactersQuery: vi.fn(),
  mockCreateSettlement: vi.fn(),
  mockDeleteSettlement: vi.fn(),
  mockSetReadiness: vi.fn(),
  mockNotifySuccess: vi.fn(),
  mockNotifyError: vi.fn(),
}));

vi.mock("../../queries/nationsQueries", () => ({
  nationSettlementsQueryOptions: (nationId: string) => ({
    queryKey: ["nation-settlements", nationId],
    queryFn: () => mockNationSettlementsQuery() as Promise<unknown>,
  }),
}));

vi.mock("@/features/citizens/queries/citizensQueries", () => ({
  playerCharactersInNationQueryOptions: (nationId: string) => ({
    queryKey: ["player-characters-in-nation", nationId],
    queryFn: () => mockPlayerCharactersQuery() as Promise<unknown>,
  }),
}));

vi.mock("@/features/settlements/mutations/settlementsMutations", () => ({
  createSettlementMutationOptions: vi.fn(
    () =>
      ({
        mutationFn: mockCreateSettlement,
      }) as never,
  ),
  deleteSettlementMutationOptions: vi.fn(
    () =>
      ({
        mutationFn: mockDeleteSettlement,
      }) as never,
  ),
}));

vi.mock(
  "@/features/settlements/mutations/settlementReadinessMutations",
  () => ({
    setSettlementReadinessMutationOptions: vi.fn(
      () =>
        ({
          mutationFn: mockSetReadiness,
        }) as never,
    ),
  }),
);

vi.mock("@/lib/notify", () => ({
  notifyMutationSuccess: mockNotifySuccess,
  notifyMutationError: mockNotifyError,
}));

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    readonly children: ReactNode;
    readonly to: string;
    readonly params: Record<string, string>;
  }) => {
    const href = Object.entries(params).reduce(
      (path, [name, value]) => path.replace(`$${name}`, value),
      to,
    );
    return <a href={href}>{children}</a>;
  },
  useNavigate: () => navigateMock,
}));

const accessContext: WorldPermissionContext = {
  canAccessWorld: () => true,
  canAdminWorld: () => true,
  isActiveUser: true,
  isAuthenticated: true,
  isSuperAdmin: false,
  playerCharacterWorldIds: [],
  userId: "user-1",
  worldAdminWorldIds: [],
};

describe("NationSettlementsSection", () => {
  const worldId = "00000000-0000-0000-0000-000000000101";
  const nationId = "11111111-1111-1111-1111-111111111111";
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayerCharactersQuery.mockResolvedValue([]);
    queryClient = new QueryClient();
  });

  function renderSection(canAdmin = false): ReturnType<typeof render> {
    return render(
      <QueryClientProvider client={queryClient}>
        <NationSettlementsSection
          accessContext={accessContext}
          canAdmin={canAdmin}
          nationId={nationId}
          worldId={worldId}
        />
      </QueryClientProvider>,
    );
  }

  describe("when canAdmin is false", () => {
    it("does not show the New settlement button", async () => {
      mockNationSettlementsQuery.mockResolvedValue([]);

      renderSection(false);

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /New settlement/ }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("when canAdmin is true", () => {
    it("shows the New settlement button", async () => {
      mockNationSettlementsQuery.mockResolvedValue([]);

      renderSection(true);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /New settlement/ }),
        ).toBeInTheDocument();
      });
    });

    it("opens the CreateSettlementDialog when button is clicked", async () => {
      const user = userEvent.setup();
      mockNationSettlementsQuery.mockResolvedValue([]);

      renderSection(true);

      const button = await screen.findByRole("button", {
        name: /New settlement/,
      });
      await user.click(button);

      // Check that the dialog appeared
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Create settlement" }),
        ).toBeInTheDocument();
      });
    });

    it("closes the dialog when onClose is called", async () => {
      const user = userEvent.setup();
      mockNationSettlementsQuery.mockResolvedValue([]);

      renderSection(true);

      const button = await screen.findByRole("button", {
        name: /New settlement/,
      });
      await user.click(button);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Create settlement" }),
        ).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(
          screen.queryByRole("heading", { name: "Create settlement" }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("settlements list", () => {
    const stonehold = {
      autoReadyEnabled: false,
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      isReadyCurrentTurn: false,
      isReadyForCurrentTurn: false,
      lastReadyAt: null,
      name: "Stonehold",
      nationId,
      nationName: "Highmark",
      population: 1250,
      readySetAt: null,
    };
    const rivertown = {
      autoReadyEnabled: false,
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      isReadyCurrentTurn: true,
      isReadyForCurrentTurn: true,
      lastReadyAt: "2024-01-01T00:00:00Z",
      name: "Rivertown",
      nationId,
      nationName: "Highmark",
      population: 2500,
      readySetAt: "2024-01-01T00:00:00Z",
    };

    it("displays settlements with links to detail page", async () => {
      mockNationSettlementsQuery.mockResolvedValue([stonehold, rivertown]);

      renderSection(true);

      // Settlement names are links
      const stoneholdTrigger = await screen.findByText("Stonehold");
      expect(stoneholdTrigger.tagName).toBe("A");
      expect(stoneholdTrigger).toHaveAttribute(
        "href",
        `/worlds/${worldId}/nations/${nationId}/settlements/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
      );

      const rivertownTrigger = screen.getByText("Rivertown");
      expect(rivertownTrigger.tagName).toBe("A");
      expect(rivertownTrigger).toHaveAttribute(
        "href",
        `/worlds/${worldId}/nations/${nationId}/settlements/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`,
      );
    });

    it("shows empty state when no settlements exist", async () => {
      mockNationSettlementsQuery.mockResolvedValue([]);

      renderSection(false);

      await waitFor(() => {
        expect(screen.getByText("No settlements")).toBeInTheDocument();
        expect(
          screen.getByText("This nation has no settlements yet."),
        ).toBeInTheDocument();
      });
    });

    it("shows the manager for a settlement, linked to the citizen", async () => {
      mockNationSettlementsQuery.mockResolvedValue([stonehold]);
      mockPlayerCharactersQuery.mockResolvedValue([
        {
          id: "citizen-1",
          name: "Alex Manager",
          profilePhotoUrl: null,
          roleSettlementId: stonehold.id,
          roleType: "settlement_manager",
        },
      ]);

      renderSection(true);

      const managerLink = await screen.findByText("Alex Manager");
      expect(managerLink.closest("a")).toHaveAttribute(
        "href",
        `/worlds/${worldId}/citizens/citizen-1`,
      );
    });

    it("shows Unassigned when a settlement has no manager", async () => {
      mockNationSettlementsQuery.mockResolvedValue([stonehold]);
      mockPlayerCharactersQuery.mockResolvedValue([]);

      renderSection(true);

      await screen.findByText("Stonehold");
      expect(screen.getByText("Unassigned")).toBeInTheDocument();
    });

    it("shows an inline readiness switch for users with authority", async () => {
      mockNationSettlementsQuery.mockResolvedValue([stonehold]);

      renderSection(true);

      await screen.findByText("Stonehold");
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    it("shows a read-only readiness state for users without authority", async () => {
      mockNationSettlementsQuery.mockResolvedValue([stonehold]);

      renderSection(false);

      await screen.findByText("Stonehold");
      expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    });

    it("deletes a settlement only via the row menu, after confirming", async () => {
      const user = userEvent.setup();
      mockNationSettlementsQuery.mockResolvedValue([stonehold]);
      mockDeleteSettlement.mockResolvedValue({
        nationId,
        settlementId: stonehold.id,
      });

      renderSection(true);

      await screen.findByText("Stonehold");
      expect(
        screen.queryByRole("button", { name: /delete/i }),
      ).not.toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: `Actions for ${stonehold.name}` }),
      );
      await user.click(
        await screen.findByRole("menuitem", { name: "Delete settlement" }),
      );

      const confirmDialog = await screen.findByRole("alertdialog");
      await user.click(
        within(confirmDialog).getByRole("button", {
          name: "Delete settlement",
        }),
      );

      await waitFor(() => {
        expect(mockDeleteSettlement).toHaveBeenCalled();
      });
      expect(mockDeleteSettlement.mock.calls[0]?.[0]).toEqual({
        nationId,
        settlementId: stonehold.id,
        worldId,
      });
    });
  });

  describe("heading", () => {
    it("displays Settlements heading", async () => {
      mockNationSettlementsQuery.mockResolvedValue([]);

      renderSection(false);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 2, name: "Settlements" }),
        ).toBeInTheDocument();
      });
    });

    it("displays button next to heading when canAdmin is true", async () => {
      mockNationSettlementsQuery.mockResolvedValue([]);

      renderSection(true);

      const heading = await screen.findByRole("heading", {
        level: 2,
        name: "Settlements",
      });
      const button = screen.getByRole("button", { name: /New settlement/ });

      // Check they're in the same section element
      const section = heading.closest("section");
      expect(section).toContainElement(button);
    });
  });
});
