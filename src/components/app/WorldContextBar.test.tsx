import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorldContextBar } from "./WorldContextBar";

describe("WorldContextBar", () => {
  it("renders the active world label", () => {
    render(<WorldContextBar />);
    expect(screen.getByLabelText("Active world context")).toBeDefined();
    expect(screen.getByText("Active world")).toBeDefined();
  });

  it("renders children inside the bar", () => {
    render(
      <WorldContextBar>
        <span>Right slot</span>
      </WorldContextBar>,
    );
    expect(screen.getByText("Right slot")).toBeDefined();
  });
});
