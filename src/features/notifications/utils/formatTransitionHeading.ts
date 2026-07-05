import {
  formatCalendarDateShort,
  resolveTurnCalendarDate,
  type WorldCalendarConfig,
} from "@/features/calendar";
import { formatDate } from "@/lib/formatDate";

import type { NotificationGroup } from "./groupNotificationsByTransition";

type TransitionHeadingGroup = Pick<
  NotificationGroup,
  "transitionId" | "toTurnNumber" | "finishedAt" | "startedAt"
>;

/**
 * "Turn 32 · 3 Jul 2026" for a transition group, using the world's calendar
 * config when available (falls back to the transition's real-world
 * finished/started timestamp), or "General" for the untransitioned bucket.
 */
export function formatTransitionHeading(
  group: TransitionHeadingGroup,
  calendarConfig: WorldCalendarConfig | null,
): string {
  if (group.transitionId === null || group.toTurnNumber === null) {
    return "General";
  }

  const fallbackIso = group.finishedAt ?? group.startedAt;
  let dateLabel = fallbackIso !== null ? formatDate(fallbackIso) : null;

  if (calendarConfig !== null) {
    try {
      dateLabel = formatCalendarDateShort(
        resolveTurnCalendarDate(calendarConfig, group.toTurnNumber),
        { shortDateFormatTemplate: calendarConfig.shortDateFormatTemplate },
      );
    } catch {
      // Keep the formatDate fallback computed above.
    }
  }

  return dateLabel !== null
    ? `Turn ${String(group.toTurnNumber)} · ${dateLabel}`
    : `Turn ${String(group.toTurnNumber)}`;
}
