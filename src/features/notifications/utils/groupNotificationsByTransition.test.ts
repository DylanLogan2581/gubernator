import { describe, expect, it } from "vitest";

import { groupNotificationsByTransition } from "./groupNotificationsByTransition";

import type { AllNotification } from "../queries/notificationQueries";

function notification(overrides: Partial<AllNotification>): AllNotification {
  return {
    citizenId: null,
    citizenName: null,
    eventId: null,
    eventName: null,
    eventIcon: null,
    generatedAt: "2026-05-03T10:00:00.000Z",
    generatedInTransitionId: null,
    id: "notif",
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

describe("groupNotificationsByTransition", () => {
  it("puts notifications without a transition id into one General group", () => {
    const groups = groupNotificationsByTransition([
      notification({ id: "n1" }),
      notification({ id: "n2" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.transitionId).toBeNull();
    expect(groups[0]?.notifications.map((n) => n.id)).toEqual(["n1", "n2"]);
  });

  it("groups notifications sharing a transition id together", () => {
    const transition = {
      toTurnNumber: 32,
      finishedAt: "2026-05-03T12:00:00.000Z",
      startedAt: "2026-05-03T11:00:00.000Z",
    };
    const groups = groupNotificationsByTransition([
      notification({
        id: "n1",
        generatedInTransitionId: "transition-1",
        worldId: "world-1",
        transition,
      }),
      notification({
        id: "n2",
        generatedInTransitionId: "transition-1",
        worldId: "world-1",
        transition,
      }),
      notification({ id: "n3" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      transitionId: "transition-1",
      worldId: "world-1",
      toTurnNumber: 32,
    });
    expect(groups[0]?.notifications.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(groups[1]?.transitionId).toBeNull();
  });

  it("preserves first-seen order across interleaved transitions", () => {
    const groups = groupNotificationsByTransition([
      notification({ id: "n1", generatedInTransitionId: "transition-2" }),
      notification({ id: "n2", generatedInTransitionId: "transition-1" }),
      notification({ id: "n3", generatedInTransitionId: "transition-2" }),
    ]);

    expect(groups.map((g) => g.transitionId)).toEqual([
      "transition-2",
      "transition-1",
    ]);
    expect(groups[0]?.notifications.map((n) => n.id)).toEqual(["n1", "n3"]);
    expect(groups[1]?.notifications.map((n) => n.id)).toEqual(["n2"]);
  });
});
