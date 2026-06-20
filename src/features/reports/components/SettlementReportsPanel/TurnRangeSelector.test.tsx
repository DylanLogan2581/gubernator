import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TurnRangeSelector } from "./TurnRangeSelector";

function setup(
  fromTurn = 1,
  toTurn = 10,
): { onApply: ReturnType<typeof vi.fn> } {
  const onApply = vi.fn();
  render(
    <TurnRangeSelector fromTurn={fromTurn} toTurn={toTurn} onApply={onApply} />,
  );
  return { onApply };
}

function fromInput(): HTMLElement {
  return screen.getByLabelText("From turn");
}

function toInput(): HTMLElement {
  return screen.getByLabelText("To turn");
}

function applyButton(): HTMLElement {
  return screen.getByRole("button", { name: "Apply" });
}

describe("TurnRangeSelector", () => {
  it("calls onApply with valid range", () => {
    const { onApply } = setup(1, 10);
    fireEvent.change(fromInput(), { target: { value: "5" } });
    fireEvent.change(toInput(), { target: { value: "15" } });
    fireEvent.click(applyButton());
    expect(onApply).toHaveBeenCalledWith(5, 15);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows error and does not call onApply when From > To", () => {
    const { onApply } = setup(1, 10);
    fireEvent.change(fromInput(), { target: { value: "32" } });
    fireEvent.change(toInput(), { target: { value: "13" } });
    fireEvent.click(applyButton());
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/must not exceed/i);
  });

  it("accepts From equal to To (single turn)", () => {
    const { onApply } = setup(1, 10);
    fireEvent.change(fromInput(), { target: { value: "5" } });
    fireEvent.change(toInput(), { target: { value: "5" } });
    fireEvent.click(applyButton());
    expect(onApply).toHaveBeenCalledWith(5, 5);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears error on valid apply after reversed range", () => {
    const { onApply } = setup(1, 10);
    fireEvent.change(fromInput(), { target: { value: "20" } });
    fireEvent.change(toInput(), { target: { value: "5" } });
    fireEvent.click(applyButton());
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(toInput(), { target: { value: "25" } });
    fireEvent.click(applyButton());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onApply).toHaveBeenCalledWith(20, 25);
  });

  it("clamps To when range exceeds MAX_RANGE=50 and shows hint", () => {
    const { onApply } = setup(1, 10);
    fireEvent.change(fromInput(), { target: { value: "1" } });
    fireEvent.change(toInput(), { target: { value: "100" } });
    fireEvent.click(applyButton());
    expect(onApply).toHaveBeenCalledWith(1, 50);
    expect(screen.getByText(/clamped to turn 50/i)).toBeInTheDocument();
  });

  it("clears clamp hint when range fits within MAX_RANGE", () => {
    const { onApply } = setup(1, 10);
    fireEvent.change(fromInput(), { target: { value: "1" } });
    fireEvent.change(toInput(), { target: { value: "100" } });
    fireEvent.click(applyButton());
    expect(screen.getByText(/clamped/i)).toBeInTheDocument();

    fireEvent.change(toInput(), { target: { value: "30" } });
    fireEvent.click(applyButton());
    expect(screen.queryByText(/clamped/i)).toBeNull();
    expect(onApply).toHaveBeenLastCalledWith(1, 30);
  });

  it("triggers apply on Enter key", () => {
    const { onApply } = setup(1, 10);
    fireEvent.keyDown(fromInput(), { key: "Enter" });
    expect(onApply).toHaveBeenCalledWith(1, 10);
  });
});
