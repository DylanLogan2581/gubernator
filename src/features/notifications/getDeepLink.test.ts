import { describe, expect, it } from "vitest";

import { getDeepLink } from "./getDeepLink";
import { type AllNotification } from "./queries/notificationQueries";

const base: AllNotification = {
  citizenId: null,
  eventId: null,
  generatedAt: "2026-01-01T00:00:00Z",
  generatedInTransitionId: null,
  id: "notif-1",
  isRead: false,
  messageText: "Test notification",
  nationId: null,
  nationName: null,
  notificationType: "test",
  settlementId: null,
  settlementName: null,
  severity: "info",
  tradeRouteId: null,
  worldId: "world-1",
  worldName: "Test World",
};

describe("getDeepLink", () => {
  it("falls back to world when no ids set", () => {
    expect(getDeepLink(base)).toEqual({
      href: "/worlds/world-1",
      label: "View world",
    });
  });

  it("links to nation when only nationId set", () => {
    const n = { ...base, nationId: "nation-1" };
    expect(getDeepLink(n)).toEqual({
      href: "/worlds/world-1/nations/nation-1",
      label: "View nation",
    });
  });

  it("links to settlement when settlementId and nationId set", () => {
    const n = { ...base, nationId: "nation-1", settlementId: "settle-1" };
    expect(getDeepLink(n)).toEqual({
      href: "/worlds/world-1/nations/nation-1/settlements/settle-1",
      label: "View settlement",
    });
  });

  it("prioritizes event over settlement/nation", () => {
    const n = {
      ...base,
      nationId: "nation-1",
      settlementId: "settle-1",
      eventId: "event-1",
    };
    expect(getDeepLink(n)).toEqual({
      href: "/worlds/world-1/events/event-1",
      label: "View event",
    });
  });

  it("links to event when only eventId set", () => {
    const n = { ...base, eventId: "event-1" };
    expect(getDeepLink(n)).toEqual({
      href: "/worlds/world-1/events/event-1",
      label: "View event",
    });
  });

  it("prioritizes citizen over event", () => {
    const n = { ...base, citizenId: "citizen-1", eventId: "event-1" };
    expect(getDeepLink(n)).toEqual({
      href: "/worlds/world-1/citizens/citizen-1",
      label: "View citizen",
    });
  });

  it("prioritizes citizen over settlement/nation", () => {
    const n = {
      ...base,
      citizenId: "citizen-1",
      nationId: "nation-1",
      settlementId: "settle-1",
    };
    expect(getDeepLink(n)).toEqual({
      href: "/worlds/world-1/citizens/citizen-1",
      label: "View citizen",
    });
  });

  it("links to citizen when only citizenId set", () => {
    const n = { ...base, citizenId: "citizen-1" };
    expect(getDeepLink(n)).toEqual({
      href: "/worlds/world-1/citizens/citizen-1",
      label: "View citizen",
    });
  });
});
