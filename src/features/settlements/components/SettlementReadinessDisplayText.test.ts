import { describe, expect, it } from "vitest";

import {
  getAutoReadyDescription,
  getManualReadinessDescription,
  getManualReadinessLabel,
  getReadinessStateLabel,
} from "./SettlementReadinessDisplayText";

import type { SettlementReadinessState } from "../utils/settlementReadinessState";

const autoReadyState: SettlementReadinessState = {
  isReadyForCurrentTurn: true,
  kind: "auto-ready",
};
const manuallyReadyState: SettlementReadinessState = {
  isReadyForCurrentTurn: true,
  kind: "manually-ready",
};
const notReadyState: SettlementReadinessState = {
  isReadyForCurrentTurn: false,
  kind: "not-ready",
};

describe("getReadinessStateLabel", () => {
  it('returns "Auto-ready" for auto-ready state', () => {
    expect(getReadinessStateLabel(autoReadyState)).toBe("Auto-ready");
  });

  it('returns "Ready" for manually-ready state', () => {
    expect(getReadinessStateLabel(manuallyReadyState)).toBe("Ready");
  });

  it('returns "Not ready" for not-ready state', () => {
    expect(getReadinessStateLabel(notReadyState)).toBe("Not ready");
  });
});

describe("getManualReadinessLabel", () => {
  it('returns "Ready (auto-ready)" for auto-ready state', () => {
    expect(getManualReadinessLabel(autoReadyState)).toBe("Ready (auto-ready)");
  });

  it('returns "Ready" for manually-ready state', () => {
    expect(getManualReadinessLabel(manuallyReadyState)).toBe("Ready");
  });

  it('returns "Not ready" for not-ready state', () => {
    expect(getManualReadinessLabel(notReadyState)).toBe("Not ready");
  });
});

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

  it("returns empty string when all flags are false", () => {
    expect(
      getManualReadinessDescription({
        isArchived: false,
        isAutoReady: false,
        isPending: false,
      }),
    ).toBe("");
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

  it("returns empty string when all flags are false", () => {
    expect(
      getAutoReadyDescription({
        isArchived: false,
        isPending: false,
      }),
    ).toBe("");
  });
});
