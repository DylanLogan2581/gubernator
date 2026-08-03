import type { Database } from "@/types/database";

import type { NotificationPreference } from "../queries/notificationPreferencesQueries";

type NotificationType = Database["public"]["Enums"]["notification_type"];

type CategoryKey =
  | "turns"
  | "settlements"
  | "citizens"
  | "trade"
  | "nations"
  | "system";

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  turns: "Turns",
  settlements: "Settlements",
  citizens: "Citizens",
  trade: "Trade",
  nations: "Nations & diplomacy",
  system: "System",
};

const CATEGORY_ORDER: readonly CategoryKey[] = [
  "turns",
  "settlements",
  "citizens",
  "trade",
  "nations",
  "system",
];

/**
 * Every notification_type mapped to a preference category. Declared as a
 * Record keyed by the full enum so a newly added notification type fails the
 * type check here instead of silently landing uncategorized.
 */
const CATEGORY_BY_NOTIFICATION_TYPE: Record<NotificationType, CategoryKey> = {
  "turn.completed": "turns",
  trade_proposal_received: "trade",
  trade_proposal_accepted: "trade",
  trade_proposal_rejected: "trade",
  trade_route_cancelled: "trade",
  "trade_route.paused": "trade",
  "trade_route.resumed": "trade",
  "building.auto_deconstructed": "settlements",
  "building.suspended": "settlements",
  "building.recovered": "settlements",
  "construction.completed": "settlements",
  "construction.paused": "settlements",
  "deposit.depleted": "settlements",
  "managed_population.declining": "settlements",
  "managed_population.extinct": "settlements",
  "settlement.homelessness_occurred": "settlements",
  "settlement.starvation_occurred": "settlements",
  "citizen.born": "citizens",
  "citizen.died": "citizens",
  "partnership.formed": "citizens",
  "partnership.widowed": "citizens",
  "player.died": "citizens",
  "player.widowed": "citizens",
  "nation.succession": "nations",
  "nation.grant_received": "nations",
  "nation.subsidy_received": "nations",
  "nation.treaty_broken": "nations",
  "nation.tribute_demanded": "nations",
  "nation.tribute_missed": "nations",
  "nation.treaty_expired": "nations",
  "currency.default": "nations",
  "currency.confidence_collapsing": "nations",
  "military.upkeep_unpaid": "nations",
  "military.unit_disbanded": "nations",
  "army.relocated": "nations",
  "law.amendment_passed": "nations",
  "law.amendment_failed": "nations",
  "law.amendment_withdrawn": "nations",
  "law.amendment_expired": "nations",
  "office.term_ended": "nations",
  "event.activated": "system",
  "event.expired": "system",
};

export type NotificationPreferenceCategory = {
  readonly key: CategoryKey;
  readonly label: string;
  readonly preferences: readonly NotificationPreference[];
  readonly enabledCount: number;
  readonly allEnabled: boolean;
  readonly isMixed: boolean;
};

/** Groups preferences by category, in a fixed display order, skipping empty categories. */
export function groupNotificationPreferencesByCategory(
  preferences: readonly NotificationPreference[],
): readonly NotificationPreferenceCategory[] {
  const preferencesByCategory = new Map<
    CategoryKey,
    NotificationPreference[]
  >();

  for (const preference of preferences) {
    const key = CATEGORY_BY_NOTIFICATION_TYPE[preference.notificationType];
    const existing = preferencesByCategory.get(key);
    if (existing === undefined) {
      preferencesByCategory.set(key, [preference]);
    } else {
      existing.push(preference);
    }
  }

  return CATEGORY_ORDER.flatMap((key) => {
    const categoryPreferences = preferencesByCategory.get(key);
    if (categoryPreferences === undefined) {
      return [];
    }

    const enabledCount = categoryPreferences.filter(
      (preference) => preference.enabled,
    ).length;

    return [
      {
        key,
        label: CATEGORY_LABELS[key],
        preferences: categoryPreferences,
        enabledCount,
        allEnabled: enabledCount === categoryPreferences.length,
        isMixed: enabledCount > 0 && enabledCount < categoryPreferences.length,
      },
    ];
  });
}
