import { render, screen } from "@testing-library/react";
import { Users } from "lucide-react";
import { describe, expect, it } from "vitest";

import { StatTile } from "./StatTile";

describe("StatTile", () => {
  it("renders label, value, and context", () => {
    render(
      <StatTile
        icon={Users}
        label="Population"
        value="1,284"
        context="Living citizens"
      />,
    );

    expect(screen.getByText("Population")).toBeDefined();
    expect(screen.getByText("1,284")).toBeDefined();
    expect(screen.getByText("Living citizens")).toBeDefined();
  });

  it("renders skeletons instead of value/context while loading", () => {
    render(
      <StatTile
        icon={Users}
        label="Population"
        value="1,284"
        context="Living citizens"
        isLoading
      />,
    );

    expect(screen.getByText("Population")).toBeDefined();
    expect(screen.queryByText("1,284")).toBeNull();
    expect(screen.queryByText("Living citizens")).toBeNull();
  });
});
