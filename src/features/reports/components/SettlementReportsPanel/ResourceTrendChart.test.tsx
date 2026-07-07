import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResourceSnapshotRow } from "@/features/reports";

import { ResourceTrendChart } from "./ResourceTrendChart";

function turnLabel(turn: number): string {
  return `T${String(turn)}`;
}

function makeRow(turnNumber: number): ResourceSnapshotRow {
  return {
    adjustment_amount: 0,
    consumed_amount: 2,
    produced_amount: 5,
    quantity_after: 10,
    quantity_before: 7,
    resource_id: "grain",
    resource_name: "Grain",
    trade_in_amount: 0,
    trade_out_amount: 0,
    turn_number: turnNumber,
  };
}

describe("ResourceTrendChart", () => {
  it("renders the no-data message when rows are empty", () => {
    render(<ResourceTrendChart rows={[]} turnLabel={turnLabel} />);
    expect(
      screen.getByText(/no resource snapshots in this turn range/i),
    ).toBeInTheDocument();
  });

  it("renders charts when rows are present", () => {
    render(
      <ResourceTrendChart
        rows={[makeRow(1), makeRow(2)]}
        turnLabel={turnLabel}
      />,
    );
    expect(screen.getByText("Stockpile (end of turn)")).toBeInTheDocument();
    expect(screen.getByText("Flows per turn")).toBeInTheDocument();
    expect(screen.queryByText(/no data for this resource/i)).toBeNull();
  });

  it("renders a single-point series without falling back to the empty state", () => {
    render(<ResourceTrendChart rows={[makeRow(1)]} turnLabel={turnLabel} />);
    expect(screen.queryByText(/no data for this resource/i)).toBeNull();
  });
});
