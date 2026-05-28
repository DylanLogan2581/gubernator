import { describe, expect, it } from "vitest";

import {
  getAutoReadyDescription,
  getManualReadinessDescription,
} from "./SettlementReadinessDisplayText";

describe("getManualReadinessDescription", () => {
  it("returns archived message when isArchived is true", () => {
    expect(
      getManualReadinessDescription({
        isArchived: true,
        isAutoReady: false,
        isPending: false,
      }),
    ).toBe("Manual readiness is disabled because this world is archived.");
  });

  it("returns archived message when isArchived is true even if isAutoReady is true", () => {
    expect(
      getManualReadinessDescription({
        isArchived: true,
        isAutoReady: true,
        isPending: false,
      }),
    ).toBe("Manual readiness is disabled because this world is archived.");
  });

  it("returns archived message when isArchived is true even if isPending is true", () => {
    expect(
      getManualReadinessDescription({
        isArchived: true,
        isAutoReady: false,
        isPending: true,
      }),
    ).toBe("Manual readiness is disabled because this world is archived.");
  });

  it("returns auto-ready message when isAutoReady is true and not archived", () => {
    expect(
      getManualReadinessDescription({
        isArchived: false,
        isAutoReady: true,
        isPending: false,
      }),
    ).toBe(
      "Auto-ready is enabled, so this settlement counts as ready without manual readiness.",
    );
  });

  it("returns auto-ready message when isAutoReady is true even if isPending is true", () => {
    expect(
      getManualReadinessDescription({
        isArchived: false,
        isAutoReady: true,
        isPending: true,
      }),
    ).toBe(
      "Auto-ready is enabled, so this settlement counts as ready without manual readiness.",
    );
  });

  it("returns saving message when isPending is true and not archived or auto-ready", () => {
    expect(
      getManualReadinessDescription({
        isArchived: false,
        isAutoReady: false,
        isPending: true,
      }),
    ).toBe("Saving manual readiness.");
  });

  it("returns toggle prompt when all flags are false", () => {
    expect(
      getManualReadinessDescription({
        isArchived: false,
        isAutoReady: false,
        isPending: false,
      }),
    ).toBe("Toggle whether this settlement is ready for the current turn.");
  });
});

describe("getAutoReadyDescription", () => {
  it("returns archived message when isArchived is true", () => {
    expect(
      getAutoReadyDescription({
        isArchived: true,
        isPending: false,
      }),
    ).toBe("Auto-ready is disabled because this world is archived.");
  });

  it("returns archived message when isArchived is true even if isPending is true", () => {
    expect(
      getAutoReadyDescription({
        isArchived: true,
        isPending: true,
      }),
    ).toBe("Auto-ready is disabled because this world is archived.");
  });

  it("returns saving message when isPending is true and not archived", () => {
    expect(
      getAutoReadyDescription({
        isArchived: false,
        isPending: true,
      }),
    ).toBe("Saving auto-ready.");
  });

  it("returns default message when all flags are false", () => {
    expect(
      getAutoReadyDescription({
        isArchived: false,
        isPending: false,
      }),
    ).toBe("Automatically count this settlement as ready for each turn.");
  });
});
