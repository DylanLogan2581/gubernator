import { describe, expect, it } from "vitest";

import { buildNotification } from "./notificationBuilder.ts";

describe("buildNotification", () => {
  it("returns a notification with all provided fields", () => {
    const result = buildNotification({
      messageText: "A deposit has been depleted.",
      nationId: "n-1",
      notificationType: "deposit.depleted",
      scope: "nation",
      settlementId: "s-1",
    });

    expect(result).toEqual({
      messageText: "A deposit has been depleted.",
      nationId: "n-1",
      notificationType: "deposit.depleted",
      scope: "nation",
      settlementId: "s-1",
    });
  });

  it("allows optional fields to be undefined", () => {
    const result = buildNotification({
      messageText: "World event occurred.",
      notificationType: "event.occurred",
      scope: "world",
    });

    expect(result.messageText).toBe("World event occurred.");
    expect(result.notificationType).toBe("event.occurred");
    expect(result.scope).toBe("world");
    expect(result.nationId).toBeUndefined();
    expect(result.settlementId).toBeUndefined();
  });
});
