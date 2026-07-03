import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AccessContext } from "@/features/permissions";
import type { WorldRouteAccess } from "@/features/worlds";

import { EventDetailPage } from "./EventDetailPage";

const WORLD_ID = "00000000-0000-0000-0000-000000000010";
const EVENT_ID = "00000000-0000-0000-0000-000000000020";

const { currentAccessContextQueryOptionsMock } = vi.hoisted(() => ({
  currentAccessContextQueryOptionsMock: vi.fn(),
}));

vi.mock("@/features/permissions", () => ({
  currentAccessContextQueryOptions: currentAccessContextQueryOptionsMock,
}));

const { worldRouteAccessQueryOptionsMock, isWorldNotFoundErrorMock } =
  vi.hoisted(() => ({
    worldRouteAccessQueryOptionsMock: vi.fn(),
    isWorldNotFoundErrorMock: vi.fn(() => false),
  }));

vi.mock("@/features/worlds", () => ({
  worldRouteAccessQueryOptions: worldRouteAccessQueryOptionsMock,
  isWorldNotFoundError: isWorldNotFoundErrorMock,
}));

vi.mock("./EventDetail", () => ({
  EventDetail: ({
    worldId,
    eventId,
    canCancel,
  }: {
    readonly worldId: string;
    readonly eventId: string;
    readonly canCancel: boolean;
  }) => (
    <div
      data-testid="event-detail"
      data-world-id={worldId}
      data-event-id={eventId}
      data-can-cancel={String(canCancel)}
    />
  ),
}));

function createAccessContext(
  overrides: Partial<AccessContext> = {},
): AccessContext {
  return {
    canAccessWorld: () => true,
    canAdminWorld: () => true,
    isActiveUser: true,
    isAuthenticated: true,
    isSuperAdmin: false,
    playerCharacterWorldIds: [],
    userId: "00000000-0000-0000-0000-000000000001",
    worldAdminWorldIds: [WORLD_ID],
    ...overrides,
  };
}

function createWorldRouteAccess(
  overrides: Partial<WorldRouteAccess> = {},
): WorldRouteAccess {
  return {
    canAdmin: true,
    canManage: true,
    header: {
      currentTurnNumber: 1,
      isArchived: false,
    } as WorldRouteAccess["header"],
    world: { id: WORLD_ID } as WorldRouteAccess["world"],
    ...overrides,
  };
}

function renderPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <EventDetailPage worldId={WORLD_ID} eventId={EVENT_ID} />
    </QueryClientProvider>,
  );
}

describe("EventDetailPage", () => {
  it("shows loading state while access context is pending", () => {
    currentAccessContextQueryOptionsMock.mockReturnValue({
      queryKey: ["access-context-pending"],
      queryFn: () => new Promise(() => {}),
    });
    worldRouteAccessQueryOptionsMock.mockReturnValue({
      queryKey: ["world-route-access-unused"],
      queryFn: () => new Promise(() => {}),
    });

    renderPage();

    expect(screen.getByText("Loading world access…")).toBeInTheDocument();
  });

  it("shows an error state when access context fails to load", async () => {
    currentAccessContextQueryOptionsMock.mockReturnValue({
      queryKey: ["access-context-error"],
      queryFn: () => Promise.reject(new Error("boom")),
    });
    worldRouteAccessQueryOptionsMock.mockReturnValue({
      queryKey: ["world-route-access-unused"],
      queryFn: () => new Promise(() => {}),
    });

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText("World access could not be loaded"),
      ).toBeInTheDocument(),
    );
  });

  it("shows an access-denied state for inactive users", async () => {
    currentAccessContextQueryOptionsMock.mockReturnValue({
      queryKey: ["access-context-inactive"],
      queryFn: () =>
        Promise.resolve(createAccessContext({ isActiveUser: false })),
    });
    worldRouteAccessQueryOptionsMock.mockReturnValue({
      queryKey: ["world-route-access-unused"],
      queryFn: () => new Promise(() => {}),
    });

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText("Account access unavailable"),
      ).toBeInTheDocument(),
    );
  });

  it("shows an access-denied state when the world is not found", async () => {
    currentAccessContextQueryOptionsMock.mockReturnValue({
      queryKey: ["access-context-ok"],
      queryFn: () => Promise.resolve(createAccessContext()),
    });
    isWorldNotFoundErrorMock.mockReturnValue(true);
    worldRouteAccessQueryOptionsMock.mockReturnValue({
      queryKey: ["world-route-access-not-found"],
      queryFn: () => Promise.reject(new Error("not found")),
      retry: false,
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("World unavailable")).toBeInTheDocument(),
    );

    isWorldNotFoundErrorMock.mockReturnValue(false);
  });

  it("renders the event detail once access and world data load", async () => {
    currentAccessContextQueryOptionsMock.mockReturnValue({
      queryKey: ["access-context-loaded"],
      queryFn: () => Promise.resolve(createAccessContext()),
    });
    worldRouteAccessQueryOptionsMock.mockReturnValue({
      queryKey: ["world-route-access-loaded"],
      queryFn: () =>
        Promise.resolve(createWorldRouteAccess({ canAdmin: true })),
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("event-detail")).toBeInTheDocument(),
    );

    const eventDetail = screen.getByTestId("event-detail");
    expect(eventDetail).toHaveAttribute("data-world-id", WORLD_ID);
    expect(eventDetail).toHaveAttribute("data-event-id", EVENT_ID);
    expect(eventDetail).toHaveAttribute("data-can-cancel", "true");
  });
});
