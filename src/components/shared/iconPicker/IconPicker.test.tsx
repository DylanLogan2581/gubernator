import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IconPicker } from "./IconPicker";

describe("IconPicker", () => {
  it("shows a placeholder when value is null", () => {
    render(<IconPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Choose icon…");
  });

  it("shows the formatted label when a value is selected", () => {
    render(<IconPicker value="cup-soda" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Cup Soda");
  });

  it("opens the popover and filters icons by search", async () => {
    const user = userEvent.setup();
    render(<IconPicker value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search icons…"), "wheat");

    expect(screen.getByRole("option", { name: "Wheat" })).toBeDefined();
    expect(screen.queryByRole("option", { name: "Apple" })).toBeNull();
  });

  it("calls onChange with the selected icon name and closes the popover", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value={null} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search icons…"), "wheat");
    await user.click(screen.getByRole("option", { name: "Wheat" }));

    expect(onChange).toHaveBeenCalledWith("wheat");
    expect(screen.queryByPlaceholderText("Search icons…")).toBeNull();
  });

  it("offers a clear option only when a value is already selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value="wheat" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");
    await user.click(within(listbox).getByText("Clear icon"));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders no clear option when value is null", async () => {
    const user = userEvent.setup();
    render(<IconPicker value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByText("Clear icon")).toBeNull();
  });
});
