import { describe, expect, it } from "vitest";

import { Constants } from "@/types/database";

import { groupNotificationPreferencesByCategory } from "./notificationCategories";

describe("groupNotificationPreferencesByCategory", () => {
  it("covers every generated notification_type enum value exactly once", () => {
    const preferences = Constants.public.Enums.notification_type.map(
      (notificationType) => ({ enabled: true, notificationType }),
    );

    const categories = groupNotificationPreferencesByCategory(preferences);
    const groupedTypes = categories.flatMap((category) =>
      category.preferences.map((preference) => preference.notificationType),
    );

    expect(groupedTypes.sort()).toEqual(
      [...Constants.public.Enums.notification_type].sort(),
    );
  });

  it("omits categories with no matching preferences", () => {
    const categories = groupNotificationPreferencesByCategory([
      { enabled: true, notificationType: "turn.completed" },
    ]);

    expect(categories).toHaveLength(1);
    expect(categories[0]?.key).toBe("turns");
  });

  it("reports enabled count and whether a category is fully enabled", () => {
    const categories = groupNotificationPreferencesByCategory([
      { enabled: true, notificationType: "citizen.born" },
      { enabled: false, notificationType: "citizen.died" },
    ]);

    expect(categories[0]).toMatchObject({
      key: "citizens",
      enabledCount: 1,
      allEnabled: false,
      isMixed: true,
    });
  });

  it("marks a category as not mixed when every preference agrees", () => {
    const allEnabled = groupNotificationPreferencesByCategory([
      { enabled: true, notificationType: "citizen.born" },
      { enabled: true, notificationType: "citizen.died" },
    ]);
    expect(allEnabled[0]).toMatchObject({ allEnabled: true, isMixed: false });

    const allDisabled = groupNotificationPreferencesByCategory([
      { enabled: false, notificationType: "citizen.born" },
      { enabled: false, notificationType: "citizen.died" },
    ]);
    expect(allDisabled[0]).toMatchObject({
      allEnabled: false,
      isMixed: false,
    });
  });
});
