import { Bell } from "lucide-react";
import { describe, expect, it } from "vitest";

import { Constants } from "@/types/database";

import { getNotificationTypeIcon } from "./notificationTypeIcons";

describe("getNotificationTypeIcon", () => {
  it("returns an icon for every generated notification_type value", () => {
    for (const notificationType of Constants.public.Enums.notification_type) {
      expect(getNotificationTypeIcon(notificationType)).toBeTypeOf("object");
    }
  });

  it("falls back to the bell icon for an unknown type", () => {
    expect(getNotificationTypeIcon("some.unmapped_type")).toBe(Bell);
  });
});
