import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NationSettlementPopulationChart } from "./NationSettlementPopulationChart";

import type { NationSettlement } from "../../types/nationTypes";

function makeSettlement(
  id: string,
  name: string,
  population: number,
): NationSettlement {
  return {
    autoReadyEnabled: false,
    id,
    isReadyCurrentTurn: false,
    isReadyForCurrentTurn: false,
    lastReadyAt: null,
    name,
    nationId: "nation-1",
    nationName: "Nation",
    population,
    readySetAt: null,
  };
}

describe("NationSettlementPopulationChart", () => {
  it("renders a loading skeleton", () => {
    const { container } = render(
      <NationSettlementPopulationChart isLoading settlements={[]} />,
    );
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it("renders an empty state when there are no settlements", () => {
    render(
      <NationSettlementPopulationChart isLoading={false} settlements={[]} />,
    );
    expect(screen.getByText("No settlements yet.")).toBeInTheDocument();
  });

  it("renders one settlement legibly", () => {
    render(
      <NationSettlementPopulationChart
        isLoading={false}
        settlements={[makeSettlement("s1", "Solo Town", 100)]}
      />,
    );
    expect(screen.getByText("Solo Town")).toBeInTheDocument();
  });

  it("renders 10+ settlements", () => {
    const settlements = Array.from({ length: 12 }, (_, index) =>
      makeSettlement(`s${String(index)}`, `Settlement ${String(index)}`, 10),
    );
    render(
      <NationSettlementPopulationChart
        isLoading={false}
        settlements={settlements}
      />,
    );
    expect(screen.getByText("Settlement 0")).toBeInTheDocument();
    expect(screen.getByText("Settlement 11")).toBeInTheDocument();
  });
});
