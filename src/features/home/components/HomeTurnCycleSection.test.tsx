import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeTurnCycleSection } from "./HomeTurnCycleSection";

const EXPECTED_STEPS = ["Plan", "Mark ready", "Simulate", "Outcome"] as const;

describe("HomeTurnCycleSection", () => {
  it("renders the four turn-cycle steps in order", () => {
    render(<HomeTurnCycleSection />);
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toStrictEqual([
      ...EXPECTED_STEPS,
    ]);
  });
});
