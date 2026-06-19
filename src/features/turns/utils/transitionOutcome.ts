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
  "building.auto_deconstructed": "Buildings Auto-Deconstructed",
  "building.recovered": "Buildings Recovered",
  "building.suspended": "Buildings Suspended",
  "citizen.born": "Citizen Born",
  "citizen.died": "Citizen Died",
  "construction.completed": "Constructions Completed",
  "construction.paused": "Constructions Paused",
  "deposit.depleted": "Deposits Depleted",
  "event.activated": "Event Activated",
  "event.expired": "Event Expired",
  "managed_population.declining": "Managed Populations Declining",
  "managed_population.extinct": "Managed Populations Extinct",
  "partnership.formed": "Partnerships Formed",
  "partnership.widowed": "Widowhoods",
  "settlement.homelessness_occurred": "Homelessness Events",
  "settlement.starvation_occurred": "Starvation Events",
  "trade_route.paused": "Trade Routes Paused",
  "trade_route.resumed": "Trade Routes Resumed",
  "turn.completed": "Turn Completed",
};

export function notificationTypeLabel(type: string): string {
  return NOTIFICATION_LABELS[type] ?? type;
}
