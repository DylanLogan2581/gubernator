import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NationSettlementsSection } from "./SettlementsSection";

import type { ReactNode } from "react";

const {
  mockNationSettlementsQuery,
  mockCreateSettlement,
  mockNotifySuccess,
  mockNotifyError,
} = vi.hoisted(() => ({
  mockNationSettlementsQuery: vi.fn(),
  mockCreateSettlement: vi.fn(),
  mockNotifySuccess: vi.fn(),
  mockNotifyError: vi.fn(),
}));

vi.mock("../../queries/nationsQueries", () => ({
  nationSettlementsQueryOptions: (nationId: string) => ({
    queryKey: ["nation-settlements", nationId],
    queryFn: () => mockNationSettlementsQuery() as Promise<unknown>,
  }),
}));

vi.mock("@/features/settlements/mutations/settlementsMutations", () => ({
  createSettlementMutationOptions: vi.fn(
    () =>
      ({
        mutationFn: mockCreateSettlement,
      }) as never,
  ),
}));

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

describe("NationSettlementsSection", () => {
  const worldId = "00000000-0000-0000-0000-000000000101";
  const nationId = "11111111-1111-1111-1111-111111111111";
  const queryClient = new QueryClient();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderSection(canAdmin = false): ReturnType<typeof render> {
    return render(
      <QueryClientProvider client={queryClient}>
        <NationSettlementsSection
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
          screen.getByRole("heading", { name: "Create Settlement" }),
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
          screen.getByRole("heading", { name: "Create Settlement" }),
        ).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(
          screen.queryByRole("heading", { name: "Create Settlement" }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("settlements list", () => {
    it("displays settlements with links to detail page", async () => {
      mockNationSettlementsQuery.mockResolvedValue([
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          name: "Stonehold",
          nationId,
        },
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          name: "Rivertown",
          nationId,
        },
      ]);

      renderSection(true);

      const stoneholdLink = await screen.findByRole("link", {
        name: "Stonehold",
      });
      expect(stoneholdLink).toHaveAttribute(
        "href",
        `/worlds/${worldId}/nations/${nationId}/settlements/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
      );

      const rivertownLink = screen.getByRole("link", { name: "Rivertown" });
      expect(rivertownLink).toHaveAttribute(
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
