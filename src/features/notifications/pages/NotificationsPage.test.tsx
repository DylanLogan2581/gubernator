import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NotificationsPage } from "./NotificationsPage";

const { currentAccessContextQueryOptionsMock } = vi.hoisted(() => ({
  currentAccessContextQueryOptionsMock: vi.fn(),
}));

vi.mock("@/features/permissions", () => ({
  currentAccessContextQueryOptions: currentAccessContextQueryOptionsMock,
}));

function renderPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <NotificationsPage />
    </QueryClientProvider>,
  );
}

describe("NotificationsPage", () => {
  it("shows a skeleton while access context is pending", async () => {
    currentAccessContextQueryOptionsMock.mockReturnValue({
      queryKey: ["access-context-pending"],
      queryFn: () => new Promise(() => {}),
    });

    renderPage();

    expect(
      await screen.findByRole("status", { name: "Loading list" }),
    ).toBeInTheDocument();
  });

  it("shows a retryable error state when access context fails to load", async () => {
    const user = userEvent.setup();
    let callCount = 0;
    currentAccessContextQueryOptionsMock.mockReturnValue({
      queryKey: ["access-context-error"],
      queryFn: () => {
        callCount += 1;
        return Promise.reject(new Error("boom"));
      },
    });

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText("Notifications could not be loaded"),
      ).toBeInTheDocument(),
    );

    const retryButton = screen.getByRole("button", { name: "Try again" });
    await user.click(retryButton);

    await waitFor(() => {
      expect(callCount).toBe(2);
    });
  });
});
