import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { NationSettlementSnapshotRow } from "@/features/reports";

import { NationSettlementTrendSmallMultiples } from "./NationSettlementTrendSmallMultiples";

function turnLabel(turn: number): string {
  return `T${String(turn)}`;
}

function makeRow(
  settlementId: string,
  settlementName: string,
  turnNumber: number,
  populationTotal: number,
): NationSettlementSnapshotRow {
  return {
    birth_count: 0,
    death_count: 0,
    homeless_deaths_count: 0,
    population_cap: 100,
    population_npc: populationTotal,
    population_player_character: 0,
    population_total: populationTotal,
    settlement_id: settlementId,
    settlement_name: settlementName,
    starvation_deaths_count: 0,
    turn_number: turnNumber,
  };
}

describe("NationSettlementTrendSmallMultiples", () => {
  it("shows an empty state when there are no rows", () => {
    render(
      <NationSettlementTrendSmallMultiples rows={[]} turnLabel={turnLabel} />,
    );
    expect(
      screen.getByText("No settlement data in this turn range."),
    ).toBeInTheDocument();
  });

  it("renders one mini chart per settlement, sorted by name", () => {
    render(
      <NationSettlementTrendSmallMultiples
        rows={[
          makeRow("s2", "Zeta Hold", 1, 50),
          makeRow("s1", "Alpha Camp", 1, 30),
          makeRow("s1", "Alpha Camp", 2, 35),
        ]}
        turnLabel={turnLabel}
      />,
    );
    const headings = screen.getAllByRole("heading", { level: 4 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "Alpha Camp",
      "Zeta Hold",
    ]);
  });
});
