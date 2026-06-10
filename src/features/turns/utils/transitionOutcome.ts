import type {
  TurnTransitionNotification,
  TurnTransitionSettlementSnapshot,
} from "../queries/turnTransitionOutcomeQueries";

export type NotificationGroup = {
  readonly notifications: TurnTransitionNotification[];
  readonly type: string;
};

export type OutcomeDeltas = {
  readonly births: number;
  readonly buildingsSuspended: number;
  readonly deaths: number;
  readonly depositsDepleted: number;
};

export function groupNotificationsByType(
  notifications: readonly TurnTransitionNotification[],
): NotificationGroup[] {
  const groups = new Map<string, TurnTransitionNotification[]>();
  for (const notification of notifications) {
    const existing = groups.get(notification.notificationType);
    if (existing !== undefined) {
      existing.push(notification);
    } else {
      groups.set(notification.notificationType, [notification]);
    }
  }
  return [...groups.entries()].map(([type, notifs]) => ({
    notifications: notifs,
    type,
  }));
}

export function computeDeltas(
  snapshots: readonly TurnTransitionSettlementSnapshot[],
  notifications: readonly TurnTransitionNotification[],
): OutcomeDeltas {
  const births = snapshots.reduce((sum, s) => sum + s.birthCount, 0);
  const deaths = snapshots.reduce((sum, s) => sum + s.deathCount, 0);
  const buildingsSuspended = notifications.filter(
    (n) => n.notificationType === "building.suspended",
  ).length;
  const depositsDepleted = notifications.filter(
    (n) => n.notificationType === "deposit.depleted",
  ).length;
  return { births, buildingsSuspended, deaths, depositsDepleted };
}

export function sortNotificationsBySettlement(
  notifications: readonly TurnTransitionNotification[],
): TurnTransitionNotification[] {
  return [...notifications].sort((a, b) => {
    // Sort by settlementId first, then by messageText
    const settlementCmp = (a.settlementId ?? "").localeCompare(
      b.settlementId ?? "",
    );
    if (settlementCmp !== 0) {
      return settlementCmp;
    }
    return a.messageText.localeCompare(b.messageText);
  });
}

export const NOTIFICATION_LABELS: Readonly<Record<string, string>> = {
  "building.auto_deconstructed": "Buildings auto-deconstructed",
  "building.suspended": "Buildings suspended",
  "construction.completed": "Constructions completed",
  "construction.paused": "Constructions paused",
  "deposit.depleted": "Deposits depleted",
  "managed_population.declining": "Managed populations declining",
  "managed_population.extinct": "Managed populations extinct",
  "partnership.formed": "Partnerships formed",
  "partnership.widowed": "Widowhoods",
  "settlement.homelessness_occurred": "Homelessness events",
  "settlement.starvation_occurred": "Starvation events",
  "trade_route.paused": "Trade routes paused",
  "trade_route.resumed": "Trade routes resumed",
};

export function notificationTypeLabel(type: string): string {
  return NOTIFICATION_LABELS[type] ?? type;
}
