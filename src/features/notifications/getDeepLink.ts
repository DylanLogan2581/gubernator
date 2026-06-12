import { type AllNotification } from "./queries/notificationQueries";

export function getDeepLink(
  notification: AllNotification,
): { href: string; label: string } | null {
  if (notification.settlementId !== null && notification.nationId !== null) {
    return {
      href: `/worlds/${notification.worldId}/nations/${notification.nationId}/settlements/${notification.settlementId}`,
      label: "View settlement",
    };
  }

  if (notification.nationId !== null) {
    return {
      href: `/worlds/${notification.worldId}/nations/${notification.nationId}`,
      label: "View nation",
    };
  }

  if (notification.eventId !== null) {
    return {
      href: `/worlds/${notification.worldId}/events/${notification.eventId}`,
      label: "View event",
    };
  }

  return {
    href: `/worlds/${notification.worldId}`,
    label: "View world",
  };
}
