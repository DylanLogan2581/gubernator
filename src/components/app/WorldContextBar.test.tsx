import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorldContextBar } from "./WorldContextBar";

describe("WorldContextBar", () => {
  it("renders the no-active-world placeholder", () => {
    render(<WorldContextBar />);
    expect(screen.getByText(/No active world/i)).toBeDefined();
  });

  it("mentions world, turn, and calendar context in the placeholder", () => {
    render(<WorldContextBar />);
    expect(screen.getByText(/turn, calendar/i)).toBeDefined();
  });
});
