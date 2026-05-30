import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NativeSelect } from "./native-select";

describe("NativeSelect", () => {
  it("renders a select element with options", () => {
    render(
      <NativeSelect aria-label="Fruit">
        <option value="apple">Apple</option>
        <option value="banana">Banana</option>
      </NativeSelect>,
    );

    expect(screen.getByRole("combobox", { name: "Fruit" })).toBeDefined();
  });

  it("calls onChange and updates value when an option is selected", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <NativeSelect aria-label="Fruit" onChange={handleChange}>
        <option value="apple">Apple</option>
        <option value="banana">Banana</option>
      </NativeSelect>,
    );

    const select = screen.getByRole("combobox", { name: "Fruit" });
    await user.selectOptions(select, "banana");

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(select).toHaveProperty("value", "banana");
  });

  it("is disabled when disabled prop is set", () => {
    render(
      <NativeSelect aria-label="Fruit" disabled>
        <option value="apple">Apple</option>
      </NativeSelect>,
    );

    expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
