import { render, screen } from "@testing-library/react";
import { Wheat } from "lucide-react";
import { describe, expect, it } from "vitest";

import { CompositionDonutChart } from "./CompositionDonutChart";

describe("CompositionDonutChart", () => {
  it("renders the empty message when every slice is zero", () => {
    render(
      <CompositionDonutChart
        emptyMessage="Nothing to show."
        slices={[{ color: "red", id: "a", label: "A", value: 0 }]}
      />,
    );
    expect(screen.getByText("Nothing to show.")).toBeInTheDocument();
  });

  it("drops zero-value slices from the legend", () => {
    render(
      <CompositionDonutChart
        emptyMessage="Nothing to show."
        slices={[
          { color: "red", id: "a", label: "Farmer", value: 3 },
          { color: "blue", id: "b", label: "Empty job", value: 0 },
        ]}
      />,
    );
    expect(screen.getByText("Farmer")).toBeInTheDocument();
    expect(screen.queryByText("Empty job")).not.toBeInTheDocument();
  });

  it("renders an icon in the legend when a slice provides one", () => {
    const { container } = render(
      <CompositionDonutChart
        emptyMessage="Nothing to show."
        slices={[
          { color: "red", icon: Wheat, id: "a", label: "Grain", value: 5 },
        ]}
      />,
    );
    expect(container.querySelector("svg.lucide-wheat")).not.toBeNull();
  });
});
