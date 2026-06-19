import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PopulationSnapshotRow } from "@/features/reports";

import { PopulationTrendChart } from "./PopulationTrendChart";

function turnLabel(turn: number): string {
  return `T${String(turn)}`;
}

function makeRow(turnNumber: number): PopulationSnapshotRow {
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

describe("PopulationTrendChart", () => {
  it("renders section headings and no-data message when rows empty", () => {
    render(<PopulationTrendChart rows={[]} turnLabel={turnLabel} />);
    expect(screen.getByText("Population over time")).toBeInTheDocument();
    expect(screen.getByText("Births and deaths per turn")).toBeInTheDocument();
    expect(
      screen.getAllByText(/no population snapshots in this turn range/i),
    ).toHaveLength(2);
  });

  it("renders charts when rows are present", () => {
    render(
      <PopulationTrendChart
        rows={[makeRow(1), makeRow(2)]}
        turnLabel={turnLabel}
      />,
    );
    expect(screen.getByText("Population over time")).toBeInTheDocument();
    expect(screen.getByText("Births and deaths per turn")).toBeInTheDocument();
    expect(screen.queryByText(/no population snapshots/i)).toBeNull();
  });
});
