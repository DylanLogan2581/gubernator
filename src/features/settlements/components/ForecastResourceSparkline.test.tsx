import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ForecastResourceSparkline } from "./ForecastResourceSparkline";

describe("ForecastResourceSparkline", () => {
  it("renders a placeholder when there are fewer than two points", () => {
    render(<ForecastResourceSparkline points={[{ quantity: 10, turn: 5 }]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByTestId("forecast-sparkline")).toBeNull();
  });

  it("renders a placeholder when there are no points", () => {
    render(<ForecastResourceSparkline points={[]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the trend chart when at least two points are present", () => {
    render(
      <ForecastResourceSparkline
        points={[
          { quantity: 10, turn: 1 },
          { quantity: 8, turn: 2 },
          { quantity: 6, turn: 3 },
        ]}
      />,
    );
    expect(screen.getByTestId("forecast-sparkline")).toBeInTheDocument();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("marks a falling trend when quantity drops meaningfully", () => {
    render(
      <ForecastResourceSparkline
        points={[
          { quantity: 10, turn: 1 },
          { quantity: 6, turn: 2 },
        ]}
      />,
    );
    expect(screen.getByTestId("forecast-sparkline")).toHaveAttribute(
      "data-trend",
      "falling",
    );
  });

  it("marks a rising trend when quantity climbs meaningfully", () => {
    render(
      <ForecastResourceSparkline
        points={[
          { quantity: 6, turn: 1 },
          { quantity: 10, turn: 2 },
        ]}
      />,
    );
    expect(screen.getByTestId("forecast-sparkline")).toHaveAttribute(
      "data-trend",
      "rising",
    );
  });

  it("marks a flat trend when quantity barely moves", () => {
    render(
      <ForecastResourceSparkline
        points={[
          { quantity: 100, turn: 1 },
          { quantity: 100, turn: 2 },
        ]}
      />,
    );
    expect(screen.getByTestId("forecast-sparkline")).toHaveAttribute(
      "data-trend",
      "flat",
    );
  });
});
