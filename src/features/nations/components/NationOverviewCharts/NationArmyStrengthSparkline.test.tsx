import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NationArmyStrengthSparkline } from "./NationArmyStrengthSparkline";

function turnLabel(turn: number): string {
  return `T${String(turn)}`;
}

describe("NationArmyStrengthSparkline", () => {
  it("renders a loading skeleton", () => {
    const { container } = render(
      <NationArmyStrengthSparkline
        isLoading
        points={[]}
        turnLabel={turnLabel}
      />,
    );
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it("renders an empty state before the first snapshot", () => {
    render(
      <NationArmyStrengthSparkline
        isLoading={false}
        points={[]}
        turnLabel={turnLabel}
      />,
    );
    expect(
      screen.getByText("No army strength history yet."),
    ).toBeInTheDocument();
  });

  it("renders the chart when snapshot points are present", () => {
    const { container } = render(
      <NationArmyStrengthSparkline
        isLoading={false}
        points={[
          { soldierCountTotal: 10, turnNumber: 1 },
          { soldierCountTotal: 14, turnNumber: 2 },
        ]}
        turnLabel={turnLabel}
      />,
    );
    expect(screen.queryByText("No army strength history yet.")).toBeNull();
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull();
  });
});
