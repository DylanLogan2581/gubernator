import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
        { enabled: true, notificationType: "citizen.died" },
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
  beforeEach(() => {
    setPreferenceMutationFn.mockClear();
  });

  it("groups notification types into categories with an enabled count", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(
      screen.getByRole("button", { name: "Notification preferences" }),
    );

    expect(
      await screen.findByRole("button", { name: /turns/i }),
    ).toHaveTextContent("1/1 on");
    expect(screen.getByRole("button", { name: /citizens/i })).toHaveTextContent(
      "1/2 on",
    );
  });

  it("only marks the category switch as mixed when the category is genuinely mixed", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(
      screen.getByRole("button", { name: "Notification preferences" }),
    );

    const turnsToggleAll = await screen.findByRole("switch", {
      name: "Toggle all Turns notifications",
    });
    const citizensToggleAll = screen.getByRole("switch", {
      name: /Toggle all Citizens notifications/,
    });

    expect(turnsToggleAll).not.toHaveAttribute("data-mixed");
    expect(citizensToggleAll).toHaveAttribute("data-mixed", "");
  });

  it("opens a category and lists its notification types with their current state", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(
      screen.getByRole("button", { name: "Notification preferences" }),
    );
    await user.click(await screen.findByRole("button", { name: /turns/i }));

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
    await user.click(await screen.findByRole("button", { name: /turns/i }));
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

  it("toggles every preference in a category with the category switch", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(
      screen.getByRole("button", { name: "Notification preferences" }),
    );
    const citizensToggleAll = await screen.findByRole("switch", {
      name: /Toggle all Citizens notifications/,
    });
    await user.click(citizensToggleAll);

    await waitFor(() => {
      expect(setPreferenceMutationFn.mock.calls[0]?.[0]).toEqual({
        enabled: true,
        notificationType: "citizen.born",
        userId: USER_ID,
      });
    });
  });

  it("does not render preference categories before the sheet is opened", () => {
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
