import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { notificationQueryKeys } from "@/features/notifications";

import { AppHeader } from "./AppHeader";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

describe("AppHeader", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    requireSupabaseClient.mockReturnValue(createClient().client);
  });

  it("renders the Gubernator app name", () => {
    renderAppHeader();
    expect(screen.getByText("Gubernator")).toBeDefined();
  });

  it("renders the app description", () => {
    renderAppHeader();
    expect(screen.getByText(/turn-based world simulation/i)).toBeDefined();
  });

  it("renders the logo image", () => {
    renderAppHeader();
    expect(screen.getByAltText("Gubernator logo")).toBeDefined();
  });

  it("renders the notification bell placeholder", () => {
    renderAppHeader();
    expect(
      screen.getByRole("button", { name: /notifications/i }),
    ).toBeDefined();
  });

  it("shows the unread notification badge when a user has unread rows", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({ sessionUserId: "user-1", initialUnreadCount: 3 }).client,
    );

    renderAppHeader();

    expect(await screen.findByText("3")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Notifications (3 unread)" }),
    ).toBeDefined();
  });

  it("refreshes the unread notification badge after notification invalidation", async () => {
    const clientFixture = createClient({
      sessionUserId: "user-1",
      initialUnreadCount: 1,
    });

    requireSupabaseClient.mockReturnValue(clientFixture.client);

    const queryClient = renderAppHeader();

    expect(
      await screen.findByRole("button", { name: "Notifications (1 unread)" }),
    ).toBeDefined();

    clientFixture.setUnreadCount(2);

    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.all,
      });
    });

    expect(
      await screen.findByRole("button", { name: "Notifications (2 unread)" }),
    ).toBeDefined();
    expect(clientFixture.select).toHaveBeenCalledTimes(2);
  });

  it("keeps notification control after header actions", () => {
    renderAppHeader(<AppHeader action={<a href="/worlds">Worlds</a>} />);

    const worldsLink = screen.getByRole("link", { name: "Worlds" });
    const notificationsButton = screen.getByRole("button", {
      name: /notifications/i,
    });

    expect(
      worldsLink.compareDocumentPosition(notificationsButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

function renderAppHeader(ui = <AppHeader />): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

  return queryClient;
}

function createClient({
  sessionUserId = null,
  initialUnreadCount = 0,
}: {
  readonly sessionUserId?: string | null;
  readonly initialUnreadCount?: number;
} = {}): {
  readonly client: unknown;
  readonly select: ReturnType<typeof vi.fn>;
  readonly setUnreadCount: (count: number) => void;
} {
  let unreadCount = initialUnreadCount;
  const select = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn().mockImplementation(() =>
        Promise.resolve({
          count: unreadCount,
          error: null,
        }),
      ),
    })),
  }));

  return {
    client: {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session:
              sessionUserId === null ? null : { user: { id: sessionUserId } },
          },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table !== "notifications") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select,
        };
      }),
    },
    select,
    setUnreadCount: (count: number): void => {
      unreadCount = count;
    },
  };
}
