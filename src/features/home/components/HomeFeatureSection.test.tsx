import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeFeatureSection } from "./HomeFeatureSection";

const EXPECTED_FEATURE_AREAS = [
  "Settlements & economy",
  "Citizens & genealogy",
  "Nations & roles",
  "Events & reports",
] as const;

describe("HomeFeatureSection", () => {
  it("renders all four shipped feature area cards", () => {
    render(<HomeFeatureSection />);
    for (const area of EXPECTED_FEATURE_AREAS) {
      expect(screen.getByRole("heading", { name: area })).toBeDefined();
    }
  });

  it("does not describe features as planned or upcoming", () => {
    render(<HomeFeatureSection />);
    expect(screen.queryByText(/planned/i)).toBeNull();
    expect(screen.queryByText(/upcoming/i)).toBeNull();
    expect(screen.queryByText(/is now live/i)).toBeNull();
  });
});
