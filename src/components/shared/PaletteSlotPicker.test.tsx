import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PaletteSlotPicker } from "./PaletteSlotPicker";

describe("PaletteSlotPicker", () => {
  it("renders all 8 palette slots plus an Auto option", () => {
    render(<PaletteSlotPicker value={null} onChange={vi.fn()} />);

    for (let slot = 1; slot <= 8; slot += 1) {
      expect(
        screen.getByRole("button", { name: `Color ${String(slot)}` }),
      ).toBeDefined();
    }
    expect(
      screen.getByRole("button", { name: "Auto (hash-based color)" }),
    ).toBeDefined();
  });

  it("marks Auto as pressed when value is null", () => {
    render(<PaletteSlotPicker value={null} onChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Auto (hash-based color)" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Color 3" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("marks the matching slot as pressed when a value is set", () => {
    render(<PaletteSlotPicker value={3} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Color 3" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Auto (hash-based color)" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the selected slot", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PaletteSlotPicker value={null} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Color 5" }));

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("calls onChange with null when Auto is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PaletteSlotPicker value={4} onChange={onChange} />);

    await user.click(
      screen.getByRole("button", { name: "Auto (hash-based color)" }),
    );

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("disables all buttons when disabled", () => {
    render(<PaletteSlotPicker disabled value={null} onChange={vi.fn()} />);

    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Color 1" })
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Auto (hash-based color)",
      }).disabled,
    ).toBe(true);
  });
});
