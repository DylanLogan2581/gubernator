import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_LABELS,
  computeDeltas,
  groupNotificationsByType,
  notificationTypeLabel,
  sortNotificationsBySettlement,
} from "./transitionOutcome";

import type {
  TurnTransitionNotification,
  TurnTransitionSettlementSnapshot,
} from "../queries/turnTransitionOutcomeQueries";

describe("transitionOutcome utils", () => {
  describe("groupNotificationsByType", () => {
    it("groups notifications by type", () => {
      const notifications: TurnTransitionNotification[] = [
        {
          id: "1",
          notificationType: "building.suspended",
          messageText: "Building A suspended",
          settlementId: "settlement-1",
        } as unknown as TurnTransitionNotification,
        {
          id: "2",
          notificationType: "deposit.depleted",
          messageText: "Deposit X depleted",
          settlementId: "settlement-1",
        } as unknown as TurnTransitionNotification,
        {
          id: "3",
          notificationType: "building.suspended",
          messageText: "Building B suspended",
          settlementId: "settlement-2",
        } as unknown as TurnTransitionNotification,
      ];

      const groups = groupNotificationsByType(notifications);

      expect(groups).toHaveLength(2);
      const buildingSuspendedGroup = groups.find(
        (g) => g.type === "building.suspended",
      );
      const depositDepletedGroup = groups.find(
        (g) => g.type === "deposit.depleted",
      );

      expect(buildingSuspendedGroup?.notifications).toHaveLength(2);
      expect(depositDepletedGroup?.notifications).toHaveLength(1);
    });

    it("returns empty array for empty notifications", () => {
      const groups = groupNotificationsByType([]);
      expect(groups).toHaveLength(0);
    });
  });

  describe("computeDeltas", () => {
    it("computes deltas from snapshots and notifications", () => {
      const snapshots: TurnTransitionSettlementSnapshot[] = [
        {
          settlementId: "settlement-1",
          birthCount: 5,
          deathCount: 2,
        } as TurnTransitionSettlementSnapshot,
        {
          settlementId: "settlement-2",
          birthCount: 3,
          deathCount: 1,
        } as TurnTransitionSettlementSnapshot,
      ];

      const notifications: TurnTransitionNotification[] = [
        {
          notificationType: "building.suspended",
        } as unknown as TurnTransitionNotification,
        {
          notificationType: "building.suspended",
        } as unknown as TurnTransitionNotification,
        {
          notificationType: "deposit.depleted",
        } as unknown as TurnTransitionNotification,
      ];

      const deltas = computeDeltas(snapshots, notifications);

      expect(deltas.births).toBe(8);
      expect(deltas.deaths).toBe(3);
      expect(deltas.buildingsSuspended).toBe(2);
      expect(deltas.depositsDepleted).toBe(1);
    });
  });

  describe("sortNotificationsBySettlement", () => {
    it("sorts by settlementId then messageText", () => {
      const notifications: TurnTransitionNotification[] = [
        {
          id: "1",
          settlementId: "settlement-2",
          messageText: "Zebra event",
        } as unknown as TurnTransitionNotification,
        {
          id: "2",
          settlementId: "settlement-1",
          messageText: "Banana event",
        } as unknown as TurnTransitionNotification,
        {
          id: "3",
          settlementId: "settlement-1",
          messageText: "Apple event",
        } as unknown as TurnTransitionNotification,
        {
          id: "4",
          settlementId: "settlement-2",
          messageText: "Apple event",
        } as unknown as TurnTransitionNotification,
      ];

      const sorted = sortNotificationsBySettlement(notifications);

      expect(sorted[0].id).toBe("3"); // settlement-1, Apple
      expect(sorted[1].id).toBe("2"); // settlement-1, Banana
      expect(sorted[2].id).toBe("4"); // settlement-2, Apple
      expect(sorted[3].id).toBe("1"); // settlement-2, Zebra
    });

    it("handles undefined settlementId", () => {
      const notifications: TurnTransitionNotification[] = [
        {
          id: "1",
          settlementId: undefined,
          messageText: "Event A",
        } as unknown as TurnTransitionNotification,
        {
          id: "2",
          settlementId: "settlement-1",
          messageText: "Event B",
        } as unknown as TurnTransitionNotification,
      ];

      const sorted = sortNotificationsBySettlement(notifications);

      // Undefined settlementId sorts first
      expect(sorted[0].id).toBe("1");
      expect(sorted[1].id).toBe("2");
    });
  });

  describe("notificationTypeLabel", () => {
    it("returns label for known type", () => {
      const label = notificationTypeLabel("building.suspended");
      expect(label).toBe("Buildings suspended");
    });

    it("returns type string for unknown type", () => {
      const label = notificationTypeLabel("unknown.event");
      expect(label).toBe("unknown.event");
    });
  });

  describe("NOTIFICATION_LABELS", () => {
    it("contains all expected keys", () => {
      const expectedKeys = [
        "building.auto_deconstructed",
        "building.suspended",
        "construction.completed",
        "construction.paused",
        "deposit.depleted",
        "managed_population.declining",
        "managed_population.extinct",
        "partnership.formed",
        "partnership.widowed",
        "settlement.homelessness_occurred",
        "settlement.starvation_occurred",
        "trade_route.paused",
        "trade_route.resumed",
      ];

      for (const key of expectedKeys) {
        expect(NOTIFICATION_LABELS[key]).toBeDefined();
      }
    });
  });
});
