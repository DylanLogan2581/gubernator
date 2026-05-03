import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    requireSupabaseClient.mockReturnValue(createClient());
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
      createClient({ sessionUserId: "user-1", unreadCount: 3 }),
    );

    renderAppHeader();

    expect(await screen.findByText("3")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Notifications (3 unread)" }),
    ).toBeDefined();
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

function renderAppHeader(ui = <AppHeader />): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function createClient({
  sessionUserId = null,
  unreadCount = 0,
}: {
  readonly sessionUserId?: string | null;
  readonly unreadCount?: number;
} = {}): unknown {
  return {
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
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              count: unreadCount,
              error: null,
            }),
          })),
        })),
      };
    }),
  };
}
