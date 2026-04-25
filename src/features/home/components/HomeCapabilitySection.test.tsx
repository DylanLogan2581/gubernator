import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeCapabilitySection } from "./HomeCapabilitySection";

const EXPECTED_FEATURE_AREAS = [
  "Worlds",
  "Nations",
  "Settlements",
  "Citizens",
  "Resources",
  "Turns & Calendar",
] as const;

describe("HomeCapabilitySection", () => {
  it("renders all six planned feature area cards", () => {
    render(<HomeCapabilitySection />);
    for (const area of EXPECTED_FEATURE_AREAS) {
      expect(screen.getByRole("heading", { name: area })).toBeDefined();
    }
  });

  it("does not claim features are functional", () => {
    render(<HomeCapabilitySection />);
    expect(screen.queryByText(/is now live/i)).toBeNull();
    expect(screen.queryByText(/available now/i)).toBeNull();
  });
});
