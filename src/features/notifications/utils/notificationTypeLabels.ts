import { Constants } from "@/types/database";

/** "settlement.starvation_occurred" -> "Settlement starvation occurred". */
export function formatNotificationTypeLabel(notificationType: string): string {
  const words = notificationType
    .split(/[._]/)
    .filter((word) => word.length > 0);
  const label = words.join(" ");
  return label.length > 0
    ? label.charAt(0).toUpperCase() + label.slice(1)
    : label;
}

export type NotificationTypeOption = {
  readonly value: string;
  readonly label: string;
};

/**
 * Type-filter options derived from the generated `notification_type` enum
 * instead of a hand-synced array, so a newly added DB type shows up here for
 * free the next time `npm run db:types` runs.
 */
export const NOTIFICATION_TYPE_OPTIONS: readonly NotificationTypeOption[] = [
  { value: "all", label: "All types" },
  ...Constants.public.Enums.notification_type.map((value) => ({
    value,
    label: formatNotificationTypeLabel(value),
  })),
];
