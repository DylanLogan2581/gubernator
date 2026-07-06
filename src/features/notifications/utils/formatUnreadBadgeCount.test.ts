import { describe, expect, it } from "vitest";

import { formatUnreadBadgeCount } from "./formatUnreadBadgeCount";

describe("formatUnreadBadgeCount", () => {
  it("renders zero as-is", () => {
    expect(formatUnreadBadgeCount(0)).toBe("0");
  });

  it("renders counts at or below the cap as-is", () => {
    expect(formatUnreadBadgeCount(42)).toBe("42");
    expect(formatUnreadBadgeCount(99)).toBe("99");
  });

  it("caps counts above 99 to 99+", () => {
    expect(formatUnreadBadgeCount(100)).toBe("99+");
    expect(formatUnreadBadgeCount(135)).toBe("99+");
  });
});
