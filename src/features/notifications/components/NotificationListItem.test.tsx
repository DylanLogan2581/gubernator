import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NotificationListItem } from "./NotificationListItem";

import type { AllNotification } from "../queries/notificationQueries";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
  }: {
    readonly children: ReactNode;
    readonly to: string;
  }) => <a href={to}>{children}</a>,
}));

function baseNotification(
  overrides: Partial<AllNotification> = {},
): AllNotification {
  return {
    citizenId: null,
    citizenName: null,
    eventId: null,
    eventName: null,
    generatedAt: "2026-05-03T10:00:00.000Z",
    generatedInTransitionId: null,
    id: "notif-1",
    isRead: false,
    messageText: "Turn 2 is complete.",
    nationId: null,
    nationName: null,
    notificationType: "turn.completed",
    settlementId: null,
    settlementName: null,
    severity: "info",
    tradeRouteId: null,
    tradeRoute: null,
    transition: null,
    worldId: "world-1",
    worldName: "Earth",
    ...overrides,
  };
}

describe("NotificationListItem", () => {
  it("renders the message, a formatted date, and no date-formatting lint escape hatch", () => {
    render(
      <NotificationListItem
        notification={baseNotification()}
        onMarkRead={vi.fn()}
        isMarkingRead={false}
      />,
    );

    expect(screen.getByText("Turn 2 is complete.")).toBeInTheDocument();
    expect(screen.getByText("May 3, 2026")).toBeInTheDocument();
  });

  it("renders an inline, clickable link for each entity id on the row", () => {
    render(
      <NotificationListItem
        notification={baseNotification({
          nationId: "nation-1",
          nationName: "Gondor",
          settlementId: "settlement-1",
          settlementName: "Minas Tirith",
        })}
        onMarkRead={vi.fn()}
        isMarkingRead={false}
      />,
    );

    expect(screen.getByRole("link", { name: "Gondor" })).toHaveAttribute(
      "href",
      "/worlds/world-1/nations/nation-1",
    );
    expect(screen.getByRole("link", { name: "Minas Tirith" })).toHaveAttribute(
      "href",
      "/worlds/world-1/nations/nation-1/settlements/settlement-1",
    );
  });

  it("shows an unread dot and a mark-read action for unread notifications", async () => {
    const onMarkRead = vi.fn();
    const user = userEvent.setup();
    render(
      <NotificationListItem
        notification={baseNotification({ isRead: false })}
        onMarkRead={onMarkRead}
        isMarkingRead={false}
      />,
    );

    const markReadButton = screen.getByRole("button", {
      name: "Mark as read",
    });
    await user.click(markReadButton);

    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  it("hides the mark-read action for read notifications", () => {
    render(
      <NotificationListItem
        notification={baseNotification({ isRead: true })}
        onMarkRead={vi.fn()}
        isMarkingRead={false}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Mark as read" }),
    ).not.toBeInTheDocument();
  });
});
