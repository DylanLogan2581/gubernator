import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DemographicsCompositionCard } from "./DemographicsCompositionCard";

const CULTURES = [
  { color: "#ff0000", id: "culture-1", name: "Sunfolk" },
  { color: "#00ff00", id: "culture-2", name: "Moonfolk" },
];
const RELIGIONS = [{ color: "#0000ff", id: "religion-1", name: "Faith" }];

describe("DemographicsCompositionCard", () => {
  it("returns null when the world has no cultures or religions defined", () => {
    const { container } = render(
      <DemographicsCompositionCard
        composition={{ byCultureId: {}, byReligionId: {} }}
        cultures={[]}
        error={null}
        isError={false}
        isLoading={false}
        religions={[]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders culture and religion charts with counts and an unassigned bucket", () => {
    render(
      <DemographicsCompositionCard
        composition={{
          byCultureId: { "culture-1": 3, unassigned: 2 },
          byReligionId: { "religion-1": 4, unassigned: 1 },
        }}
        cultures={CULTURES}
        error={null}
        isError={false}
        isLoading={false}
        religions={RELIGIONS}
      />,
    );

    expect(screen.getByText("Demographics")).toBeInTheDocument();
    expect(screen.getByText("Sunfolk")).toBeInTheDocument();
    expect(screen.queryByText("Moonfolk")).not.toBeInTheDocument();
    expect(screen.getByText("Faith")).toBeInTheDocument();
    expect(screen.getAllByText("Unassigned")).toHaveLength(2);
  });

  it("still renders the card while loading, even with no data yet", () => {
    render(
      <DemographicsCompositionCard
        composition={undefined}
        cultures={undefined}
        error={null}
        isError={false}
        isLoading
        religions={undefined}
      />,
    );
    expect(screen.getByText("Demographics")).toBeInTheDocument();
  });

  it("renders an error state when a query fails", () => {
    render(
      <DemographicsCompositionCard
        composition={undefined}
        cultures={CULTURES}
        error={new Error("boom")}
        isError
        isLoading={false}
        religions={RELIGIONS}
      />,
    );
    expect(screen.getByText("Failed to load demographics")).toBeInTheDocument();
  });
});
