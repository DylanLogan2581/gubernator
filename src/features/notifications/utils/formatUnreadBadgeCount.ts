const UNREAD_BADGE_CAP = 99;

/**
 * "42" for counts at or below the cap, "99+" above it — keeps every unread
 * badge (topbar bell, sidebar nav item) rendering the same text instead of
 * one site showing a raw count while another caps it.
 */
export function formatUnreadBadgeCount(count: number): string {
  return count > UNREAD_BADGE_CAP
    ? `${String(UNREAD_BADGE_CAP)}+`
    : String(count);
}
