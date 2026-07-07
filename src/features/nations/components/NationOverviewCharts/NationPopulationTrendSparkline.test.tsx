import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { NationPopulationAggregateRow } from "@/features/reports";

import { NationPopulationTrendSparkline } from "./NationPopulationTrendSparkline";

function turnLabel(turn: number): string {
  return `T${String(turn)}`;
}

function makeRow(turnNumber: number): NationPopulationAggregateRow {
  return {
    birth_count: 0,
    death_count: 0,
    homeless_deaths_count: 0,
    population_cap: 100,
    population_npc: 50,
    population_player_character: 5,
    population_total: 55,
    starvation_deaths_count: 0,
    turn_number: turnNumber,
  };
}

describe("NationPopulationTrendSparkline", () => {
  it("renders a loading skeleton", () => {
    const { container } = render(
      <NationPopulationTrendSparkline
        isLoading
        rows={[]}
        turnLabel={turnLabel}
      />,
    );
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it("renders an empty state when there is no snapshot data", () => {
    render(
      <NationPopulationTrendSparkline
        isLoading={false}
        rows={[]}
        turnLabel={turnLabel}
      />,
    );
    expect(screen.getByText("No population history yet.")).toBeInTheDocument();
  });

  it("renders the chart when rows are present", () => {
    const { container } = render(
      <NationPopulationTrendSparkline
        isLoading={false}
        rows={[makeRow(1), makeRow(2)]}
        turnLabel={turnLabel}
      />,
    );
    expect(screen.queryByText("No population history yet.")).toBeNull();
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull();
  });
});
