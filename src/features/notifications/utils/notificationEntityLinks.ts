import { entityRoute } from "@/lib/entityRoutes";

import type { AllNotification } from "../queries/notificationQueries";

export type NotificationEntityLink = {
  readonly key: string;
  readonly label: string;
  /** Null when the row doesn't carry enough data to build a valid route. */
  readonly href: string | null;
};

/**
 * Builds one inline link per entity id carried by a notification row
 * (nation/settlement/citizen/event/trade route), instead of the single
 * "best" deep link `getDeepLink` picks by precedence. Falls back to a
 * generic label when the name isn't embedded (e.g. a citizen outside the
 * recipient's visibility) but keeps the link itself, since the id is known.
 */
export function getNotificationEntityLinks(
  notification: AllNotification,
): readonly NotificationEntityLink[] {
  const links: NotificationEntityLink[] = [];

  if (notification.nationId !== null) {
    links.push({
      key: "nation",
      label: notification.nationName ?? "Nation",
      href: entityRoute(notification.worldId, {
        kind: "nation",
        nationId: notification.nationId,
      }),
    });
  }

  if (notification.settlementId !== null) {
    links.push({
      key: "settlement",
      label: notification.settlementName ?? "Settlement",
      href: entityRoute(notification.worldId, {
        kind: "settlement",
        nationId: notification.nationId,
        settlementId: notification.settlementId,
      }),
    });
  }

  if (notification.citizenId !== null) {
    links.push({
      key: "citizen",
      label: notification.citizenName ?? "Citizen",
      href: entityRoute(notification.worldId, {
        kind: "citizen",
        citizenId: notification.citizenId,
      }),
    });
  }

  if (notification.eventId !== null) {
    links.push({
      key: "event",
      label: notification.eventName ?? "Event",
      href: entityRoute(notification.worldId, {
        kind: "event",
        eventId: notification.eventId,
      }),
    });
  }

  if (notification.tradeRoute !== null) {
    links.push({
      key: "trade-route",
      label: notification.tradeRoute.originSettlementName,
      href: entityRoute(notification.worldId, {
        kind: "tradeRoute",
        nationId: notification.tradeRoute.originNationId,
        settlementId: notification.tradeRoute.originSettlementId,
      }),
    });
  } else if (notification.tradeRouteId !== null) {
    links.push({
      key: "trade-route",
      label: "Trade route",
      href: null,
    });
  }

  return links;
}
