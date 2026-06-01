import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders a textarea element", () => {
    render(<Textarea aria-label="Notes" />);

    expect(screen.getByRole("textbox", { name: "Notes" })).toBeDefined();
  });

  it("forwards className to the textarea element", () => {
    render(<Textarea aria-label="Notes" className="custom-class" />);

    expect(
      screen
        .getByRole("textbox", { name: "Notes" })
        .classList.contains("custom-class"),
    ).toBe(true);
  });

  it("forwards additional props to the textarea element", () => {
    render(<Textarea aria-label="Notes" disabled />);

    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveAttribute(
      "disabled",
    );
  });
});
