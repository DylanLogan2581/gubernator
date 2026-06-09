import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SettlementReadinessListItem } from "@/features/settlements";

import { AutoReadyControl } from "./AutoReadyControl";
import { ManualReadinessControl } from "./ManualReadinessControl";

function createTestSettlement(
  overrides?: Partial<SettlementReadinessListItem>,
): SettlementReadinessListItem {
  return {
    id: "test-id",
    name: "Test Settlement",
    nationId: "nation-1",
    nationName: "Test Nation",
    autoReadyEnabled: false,
    isReadyCurrentTurn: false,
    isReadyForCurrentTurn: false,
    lastReadyAt: null,
    readySetAt: null,
    ...overrides,
  };
}

describe("ManualReadinessControl", () => {
  it("renders label with fixed-width classes", () => {
    const settlement = createTestSettlement();
    render(
      <ManualReadinessControl
        isArchived={false}
        isPending={false}
        item={settlement}
        setReadiness={() => {}}
      />,
    );

    const labelSpans = screen.getAllByText(
      /^(?:Not ready|Ready|Ready \(auto-ready\))$/,
    );
    // Find the span that's part of the label (not the toggle itself)
    const labelTextSpan = labelSpans.find((span) =>
      span.className.includes("min-w"),
    );

    expect(labelTextSpan).toBeDefined();
    expect(labelTextSpan?.className).toContain("min-w-[8rem]");
    expect(labelTextSpan?.className).toContain("tabular-nums");
  });

  it("maintains label width when toggling ready states", async () => {
    const user = userEvent.setup();
    const handleSetReadiness = vi.fn();
    const settlement = createTestSettlement();

    const { rerender } = render(
      <ManualReadinessControl
        isArchived={false}
        isPending={false}
        item={settlement}
        setReadiness={handleSetReadiness}
      />,
    );

    const input = screen.getByRole("switch");
    const labelBefore = screen.getByText("Not ready");

    expect(labelBefore.className).toContain("min-w-[8rem]");

    // Simulate ready state
    await user.click(input);
    handleSetReadiness.mockClear();

    rerender(
      <ManualReadinessControl
        isArchived={false}
        isPending={false}
        item={{ ...settlement, isReadyCurrentTurn: true }}
        setReadiness={handleSetReadiness}
      />,
    );

    const labelAfter = screen.getByText("Ready");
    expect(labelAfter.className).toContain("min-w-[8rem]");
    expect(labelAfter.className).toContain("tabular-nums");
  });

  it("shows correct label for auto-ready state", () => {
    const settlement = createTestSettlement({
      autoReadyEnabled: true,
      isReadyCurrentTurn: true,
    });

    render(
      <ManualReadinessControl
        isArchived={false}
        isPending={false}
        item={settlement}
        setReadiness={() => {}}
      />,
    );

    const label = screen.getByText("Ready (auto-ready)");
    expect(label.className).toContain("min-w-[8rem]");
    expect(label.className).toContain("tabular-nums");
  });
});

describe("AutoReadyControl", () => {
  it("renders label with fixed-width classes", () => {
    const settlement = createTestSettlement();
    render(
      <AutoReadyControl
        isArchived={false}
        isPending={false}
        item={settlement}
        setAutoReady={() => {}}
      />,
    );

    const labelTextSpan = screen.getByText("Auto-ready");
    expect(labelTextSpan.className).toContain("min-w-[8rem]");
    expect(labelTextSpan.className).toContain("tabular-nums");
  });

  it("maintains label width when toggling auto-ready", async () => {
    const user = userEvent.setup();
    const handleSetAutoReady = vi.fn();
    const settlement = createTestSettlement();

    render(
      <AutoReadyControl
        isArchived={false}
        isPending={false}
        item={settlement}
        setAutoReady={handleSetAutoReady}
      />,
    );

    const input = screen.getByRole("switch");
    const label = screen.getByText("Auto-ready");

    expect(label.className).toContain("min-w-[8rem]");
    expect(label.className).toContain("tabular-nums");

    // Click to toggle
    await user.click(input);

    const labelAfter = screen.getByText("Auto-ready");
    expect(labelAfter.className).toContain("min-w-[8rem]");
    expect(labelAfter.className).toContain("tabular-nums");
  });
});
