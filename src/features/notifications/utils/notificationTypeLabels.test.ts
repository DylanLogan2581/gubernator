import { describe, expect, it } from "vitest";

import { Constants } from "@/types/database";

import {
  formatNotificationTypeLabel,
  NOTIFICATION_TYPE_OPTIONS,
} from "./notificationTypeLabels";

describe("formatNotificationTypeLabel", () => {
  it("formats a dot-separated type", () => {
    expect(formatNotificationTypeLabel("turn.completed")).toBe(
      "Turn completed",
    );
  });

  it("formats an underscore-separated type", () => {
    expect(formatNotificationTypeLabel("trade_proposal_received")).toBe(
      "Trade proposal received",
    );
  });

  it("formats a type combining a dot and underscores", () => {
    expect(formatNotificationTypeLabel("managed_population.declining")).toBe(
      "Managed population declining",
    );
  });
});

describe("NOTIFICATION_TYPE_OPTIONS", () => {
  it("leads with an 'all' option", () => {
    expect(NOTIFICATION_TYPE_OPTIONS[0]).toEqual({
      value: "all",
      label: "All types",
    });
  });

  it("includes every generated notification_type enum value exactly once", () => {
    const values = NOTIFICATION_TYPE_OPTIONS.filter(
      (option) => option.value !== "all",
    ).map((option) => option.value);

    expect(values).toEqual(Constants.public.Enums.notification_type);
  });
});
