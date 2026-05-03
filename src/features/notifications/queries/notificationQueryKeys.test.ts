import { describe, expect, it } from "vitest";

import { notificationQueryKeys } from "./notificationQueryKeys";

describe("notificationQueryKeys", () => {
  it("uses auth-dependent notification keys", () => {
    expect(notificationQueryKeys.all).toEqual(["notifications"]);
    expect(notificationQueryKeys.unreadCount("user-1")).toEqual([
      "notifications",
      "unread-count",
      "user-1",
    ]);
  });
});
