import { describe, expect, it } from "vitest";

import { getNotificationEntityLinks } from "./notificationEntityLinks";

import type { AllNotification } from "../queries/notificationQueries";

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
    messageText: "Something happened.",
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

describe("getNotificationEntityLinks", () => {
  it("returns no links when the row carries no entity ids", () => {
    expect(getNotificationEntityLinks(baseNotification())).toEqual([]);
  });

  it("links the nation by name", () => {
    const links = getNotificationEntityLinks(
      baseNotification({ nationId: "nation-1", nationName: "Gondor" }),
    );

    expect(links).toEqual([
      {
        key: "nation",
        label: "Gondor",
        href: "/worlds/world-1/nations/nation-1",
      },
    ]);
  });

  it("links the settlement nested under its nation", () => {
    const links = getNotificationEntityLinks(
      baseNotification({
        nationId: "nation-1",
        nationName: "Gondor",
        settlementId: "settlement-1",
        settlementName: "Minas Tirith",
      }),
    );

    expect(links).toContainEqual({
      key: "settlement",
      label: "Minas Tirith",
      href: "/worlds/world-1/nations/nation-1/settlements/settlement-1",
    });
  });

  it("leaves the settlement unlinked when no nation id is present", () => {
    const links = getNotificationEntityLinks(
      baseNotification({
        settlementId: "settlement-1",
        settlementName: "Minas Tirith",
      }),
    );

    expect(links).toEqual([
      { key: "settlement", label: "Minas Tirith", href: null },
    ]);
  });

  it("falls back to a generic label when the citizen name isn't embedded", () => {
    const links = getNotificationEntityLinks(
      baseNotification({ citizenId: "citizen-1", citizenName: null }),
    );

    expect(links).toEqual([
      {
        key: "citizen",
        label: "Citizen",
        href: "/worlds/world-1/citizens/citizen-1",
      },
    ]);
  });

  it("links the event by name", () => {
    const links = getNotificationEntityLinks(
      baseNotification({ eventId: "event-1", eventName: "Harvest Festival" }),
    );

    expect(links).toEqual([
      {
        key: "event",
        label: "Harvest Festival",
        href: "/worlds/world-1/events/event-1",
      },
    ]);
  });

  it("links a resolved trade route via its origin settlement", () => {
    const links = getNotificationEntityLinks(
      baseNotification({
        tradeRouteId: "route-1",
        tradeRoute: {
          originSettlementId: "settlement-1",
          originSettlementName: "Minas Tirith",
          originNationId: "nation-1",
        },
      }),
    );

    expect(links).toEqual([
      {
        key: "trade-route",
        label: "Minas Tirith",
        href: "/worlds/world-1/nations/nation-1/settlements/settlement-1/trade",
      },
    ]);
  });

  it("renders an unlinked placeholder when the trade route id has no embed", () => {
    const links = getNotificationEntityLinks(
      baseNotification({ tradeRouteId: "route-1", tradeRoute: null }),
    );

    expect(links).toEqual([
      { key: "trade-route", label: "Trade route", href: null },
    ]);
  });
});
