import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorldDatePicker } from "./WorldDatePicker";

const mockConfig = {
  dateFormatTemplate: "{weekday} {month} {day}, Year {year}",
  months: [
    { index: 0, name: "Primrose", dayCount: 30 },
    { index: 1, name: "Sunburst", dayCount: 31 },
    { index: 2, name: "Harvest", dayCount: 30 },
  ],
  weekdays: [
    { index: 0, name: "Sunday" },
    { index: 1, name: "Monday" },
    { index: 2, name: "Tuesday" },
    { index: 3, name: "Wednesday" },
    { index: 4, name: "Thursday" },
    { index: 5, name: "Friday" },
    { index: 6, name: "Saturday" },
  ],
  startingYear: 1000,
  startingMonthIndex: 0,
  startingDayOfMonth: 1,
  startingWeekdayOffset: 0,
};

describe("WorldDatePicker", () => {
  it("renders button with date label", () => {
    const onTurnNumberChange = vi.fn();

    render(
      <WorldDatePicker
        config={mockConfig}
        currentTurnNumber={1}
        disabled={false}
        label="Test picker"
        onTurnNumberChange={onTurnNumberChange}
        value={{
          year: 1000,
          monthIndex: 0,
          dayOfMonth: 1,
        }}
      />,
    );

    const button = screen.getByRole("button", { name: /test picker/i });
    expect(button).toBeInTheDocument();
    expect(button.textContent).toContain("Primrose");
  });

  it("displays today marker when date matches current turn", () => {
    const onTurnNumberChange = vi.fn();

    render(
      <WorldDatePicker
        config={mockConfig}
        currentTurnNumber={1}
        disabled={false}
        label="Test picker"
        onTurnNumberChange={onTurnNumberChange}
        value={{
          year: 1000,
          monthIndex: 0,
          dayOfMonth: 1,
        }}
      />,
    );

    const button = screen.getByRole("button", { name: /test picker/i });
    expect(button.textContent).toContain("(today)");
  });

  it("does not display today marker when date differs from current turn", () => {
    const onTurnNumberChange = vi.fn();

    render(
      <WorldDatePicker
        config={mockConfig}
        currentTurnNumber={1}
        disabled={false}
        label="Test picker"
        onTurnNumberChange={onTurnNumberChange}
        value={{
          year: 1001,
          monthIndex: 0,
          dayOfMonth: 1,
        }}
      />,
    );

    const button = screen.getByRole("button", { name: /test picker/i });
    expect(button.textContent).not.toContain("(today)");
  });

  it("opens popover when button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <WorldDatePicker
        config={mockConfig}
        currentTurnNumber={1}
        disabled={false}
        label="Test picker"
        onTurnNumberChange={vi.fn()}
        value={{
          year: 1000,
          monthIndex: 0,
          dayOfMonth: 1,
        }}
      />,
    );

    const button = screen.getByRole("button", { name: /test picker/i });
    await user.click(button);

    expect(
      screen.getByRole("combobox", { name: /month/i }),
    ).toBeInTheDocument();
  });

  it("displays weekday when popover is open", async () => {
    const user = userEvent.setup();

    render(
      <WorldDatePicker
        config={mockConfig}
        currentTurnNumber={1}
        disabled={false}
        label="Test picker"
        onTurnNumberChange={vi.fn()}
        value={{
          year: 1000,
          monthIndex: 0,
          dayOfMonth: 1,
        }}
      />,
    );

    const button = screen.getByRole("button", { name: /test picker/i });
    await user.click(button);

    expect(screen.getByText(/weekday:/i)).toBeInTheDocument();
    expect(screen.getByText("Sunday")).toBeInTheDocument();
  });

  it("has year input field that accepts text", async () => {
    const user = userEvent.setup();

    render(
      <WorldDatePicker
        config={mockConfig}
        currentTurnNumber={1}
        disabled={false}
        label="Test picker"
        onTurnNumberChange={vi.fn()}
        value={{
          year: 1000,
          monthIndex: 0,
          dayOfMonth: 1,
        }}
      />,
    );

    const button = screen.getByRole("button", { name: /test picker/i });
    await user.click(button);

    const yearInput = screen.getByRole("textbox", { name: /year/i });
    expect(yearInput).toHaveValue("1000");
  });

  it("shows jump to today button when not on current date", async () => {
    const user = userEvent.setup();

    render(
      <WorldDatePicker
        config={mockConfig}
        currentTurnNumber={1}
        disabled={false}
        label="Test picker"
        onTurnNumberChange={vi.fn()}
        value={{
          year: 1001,
          monthIndex: 0,
          dayOfMonth: 1,
        }}
      />,
    );

    const button = screen.getByRole("button", { name: /test picker/i });
    await user.click(button);

    expect(
      screen.getByRole("button", { name: /jump to today/i }),
    ).toBeInTheDocument();
  });

  it("does not show jump to today button when on current date", async () => {
    const user = userEvent.setup();

    render(
      <WorldDatePicker
        config={mockConfig}
        currentTurnNumber={1}
        disabled={false}
        label="Test picker"
        onTurnNumberChange={vi.fn()}
        value={{
          year: 1000,
          monthIndex: 0,
          dayOfMonth: 1,
        }}
      />,
    );

    const button = screen.getByRole("button", { name: /test picker/i });
    await user.click(button);

    expect(
      screen.queryByRole("button", { name: /jump to today/i }),
    ).not.toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    const onTurnNumberChange = vi.fn();

    render(
      <WorldDatePicker
        config={mockConfig}
        currentTurnNumber={1}
        disabled={true}
        label="Test picker"
        onTurnNumberChange={onTurnNumberChange}
        value={{
          year: 1000,
          monthIndex: 0,
          dayOfMonth: 1,
        }}
      />,
    );

    const button = screen.getByRole("button", { name: /test picker/i });
    expect(button).toBeDisabled();
  });

  it("handles turn 0 worlds without displaying Invalid", async () => {
    const user = userEvent.setup();

    render(
      <WorldDatePicker
        config={mockConfig}
        currentTurnNumber={0}
        disabled={false}
        label="Test picker"
        onTurnNumberChange={vi.fn()}
        value={{
          year: 1000,
          monthIndex: 0,
          dayOfMonth: 1,
        }}
      />,
    );

    const button = screen.getByRole("button", { name: /test picker/i });
    await user.click(button);

    // Should display valid weekday, not "Invalid"
    expect(screen.getByText("Sunday")).toBeInTheDocument();
    expect(screen.queryByText("Invalid")).not.toBeInTheDocument();

    // Should display valid relative time, not "Invalid"
    const allTexts = screen.getAllByText(/today|from today|ago/i);
    // Find the one in the relative-time div (not in button text)
    const relativeTimeText = allTexts.find(
      (el) => el.className.includes("mt-1") || el.textContent === "Today",
    );
    expect(relativeTimeText).toBeInTheDocument();
  });
});
