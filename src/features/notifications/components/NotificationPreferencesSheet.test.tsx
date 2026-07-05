import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NotificationPreferencesSheet } from "./NotificationPreferencesSheet";

const { setPreferenceMutationFn } = vi.hoisted(() => ({
  setPreferenceMutationFn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../queries/notificationPreferencesQueries", () => ({
  notificationPreferencesQueryOptions: (userId: string | null) => ({
    queryFn: () =>
      Promise.resolve([
        { enabled: true, notificationType: "turn.completed" },
        { enabled: false, notificationType: "citizen.born" },
      ]),
    queryKey: ["notifications", "preferences", userId],
  }),
}));

vi.mock("../mutations/notificationPreferencesMutations", () => ({
  setNotificationPreferenceMutationOptions: () => ({
    mutationFn: setPreferenceMutationFn,
  }),
}));

const USER_ID = "user-1";

describe("NotificationPreferencesSheet", () => {
  it("opens the sheet and lists every notification type with its current state", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(
      screen.getByRole("button", { name: "Notification preferences" }),
    );

    expect(
      await screen.findByRole("switch", { name: /turn completed/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("switch", { name: /citizen born/i }),
    ).not.toBeChecked();
  });

  it("mutates with the toggled value and the current user id", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(
      screen.getByRole("button", { name: "Notification preferences" }),
    );
    const turnCompletedSwitch = await screen.findByRole("switch", {
      name: /turn completed/i,
    });
    await user.click(turnCompletedSwitch);

    await waitFor(() => {
      expect(setPreferenceMutationFn.mock.calls[0]?.[0]).toEqual({
        enabled: false,
        notificationType: "turn.completed",
        userId: USER_ID,
      });
    });
  });

  it("does not render preference rows before the sheet is opened", () => {
    renderSheet();

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});

function renderSheet(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <NotificationPreferencesSheet userId={USER_ID} />
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
