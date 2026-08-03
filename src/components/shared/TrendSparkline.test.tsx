import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrendSparkline } from "./TrendSparkline";

function turnLabel(turn: number): string {
  return `T${String(turn)}`;
}

const baseProps = {
  color: "var(--chart-1)",
  dataKey: "population_total",
  emptyMessage: "No population history yet.",
  label: "Population",
  turnLabel,
} as const;

describe("TrendSparkline", () => {
  it("renders a loading skeleton", () => {
    const { container } = render(
      <TrendSparkline {...baseProps} isLoading points={[]} />,
    );
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it("renders the empty message when there are no points", () => {
    render(<TrendSparkline {...baseProps} isLoading={false} points={[]} />);
    expect(screen.getByText("No population history yet.")).toBeInTheDocument();
  });

  it("renders the chart when points are present", () => {
    const { container } = render(
      <TrendSparkline
        {...baseProps}
        isLoading={false}
        points={[
          { turnNumber: 1, value: 55 },
          { turnNumber: 2, value: 60 },
        ]}
      />,
    );
    expect(screen.queryByText("No population history yet.")).toBeNull();
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull();
  });
});
