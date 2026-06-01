import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PercentInput } from "./PercentInput";

describe("PercentInput", () => {
  it("displays a 0–1 float as a whole-number percentage", () => {
    render(
      <PercentInput aria-label="Seek chance" value={0.25} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("spinbutton", { name: "Seek chance" })).toHaveValue(
      25,
    );
  });

  it("rounds the displayed value to avoid floating-point artefacts", () => {
    render(
      <PercentInput aria-label="Seek chance" value={0.3} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("spinbutton", { name: "Seek chance" })).toHaveValue(
      30,
    );
  });

  it("shows a percent symbol suffix", () => {
    render(
      <PercentInput aria-label="Seek chance" value={0.1} onChange={vi.fn()} />,
    );
    expect(screen.getByText("%")).toBeDefined();
  });

  it("calls onChange with a 0–1 float when the user types a whole percent", () => {
    const onChange = vi.fn<(value: number) => void>();
    render(
      <PercentInput
        aria-label="Seek chance"
        value={0.25}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole("spinbutton", { name: "Seek chance" });
    fireEvent.change(input, { target: { value: "50" } });
    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it("passes through disabled to the underlying input", () => {
    render(
      <PercentInput
        aria-label="Seek chance"
        value={0.5}
        onChange={vi.fn()}
        disabled
      />,
    );
    expect(
      screen.getByRole("spinbutton", { name: "Seek chance" }),
    ).toBeDisabled();
  });
});
