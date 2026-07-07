import type { AllNotification } from "../queries/notificationQueries";

export type NotificationGroup = {
  readonly key: string;
  readonly transitionId: string | null;
  /** Shared by every notification in the group; a transition always belongs to one world. */
  readonly worldId: string | null;
  readonly toTurnNumber: number | null;
  readonly finishedAt: string | null;
  readonly startedAt: string | null;
  readonly notifications: readonly AllNotification[];
};

const GENERAL_GROUP_KEY = "general";

/**
 * Groups an already-sorted (newest first) notification page by
 * `generatedInTransitionId`, preserving each group's first-seen position so
 * section order still reads newest first. Notifications without a
 * transition id fall into one "General" group (transitionId: null).
 */
export function groupNotificationsByTransition(
  notifications: readonly AllNotification[],
): readonly NotificationGroup[] {
  const order: string[] = [];
  const groups = new Map<
    string,
    {
      transitionId: string | null;
      worldId: string | null;
      toTurnNumber: number | null;
      finishedAt: string | null;
      startedAt: string | null;
      notifications: AllNotification[];
    }
  >();

  for (const notification of notifications) {
    const key = notification.generatedInTransitionId ?? GENERAL_GROUP_KEY;
    let group = groups.get(key);

    if (group === undefined) {
      group = {
        transitionId: notification.generatedInTransitionId,
        worldId:
          notification.generatedInTransitionId !== null
            ? notification.worldId
            : null,
        toTurnNumber: notification.transition?.toTurnNumber ?? null,
        finishedAt: notification.transition?.finishedAt ?? null,
        startedAt: notification.transition?.startedAt ?? null,
        notifications: [],
      };
      groups.set(key, group);
      order.push(key);
    }

    group.notifications.push(notification);
  }

  return order.map((key) => {
    const group = groups.get(key);
    if (group === undefined) {
      throw new Error(`unreachable: missing group for key ${key}`);
    }
    return { key, ...group };
  });
}
