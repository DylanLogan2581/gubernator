import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ColorPicker } from "./ColorPicker";

function ControlledColorPicker({
  disabled,
  initialValue,
  onChange,
}: {
  readonly disabled?: boolean;
  readonly initialValue: string;
  readonly onChange: (hex: string) => void;
}): React.JSX.Element {
  const [value, setValue] = useState(initialValue);
  return (
    <ColorPicker
      disabled={disabled}
      value={value}
      onChange={(hex) => {
        setValue(hex);
        onChange(hex);
      }}
    />
  );
}

describe("ColorPicker", () => {
  it("forwards a valid typed hex value, normalized to lowercase", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(hex: string) => void>();

    render(
      <ControlledColorPicker initialValue="#6b7280" onChange={onChange} />,
    );

    const hexInput = screen.getByRole("textbox", { name: "Color hex value" });
    await user.clear(hexInput);
    await user.type(hexInput, "#ABCDEF");

    expect(onChange).toHaveBeenLastCalledWith("#abcdef");
  });

  it("forwards partial typed input unchanged until it matches the hex pattern", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(hex: string) => void>();

    render(
      <ControlledColorPicker initialValue="#6b7280" onChange={onChange} />,
    );

    const hexInput = screen.getByRole("textbox", { name: "Color hex value" });
    await user.clear(hexInput);
    await user.type(hexInput, "#abc");

    expect(onChange).toHaveBeenLastCalledWith("#abc");
  });

  it("disables both inputs when disabled", () => {
    render(<ColorPicker disabled value="#6b7280" onChange={vi.fn()} />);

    expect(
      screen.getByLabelText<HTMLInputElement>("Color swatch").disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>("textbox", {
        name: "Color hex value",
      }).disabled,
    ).toBe(true);
  });
});
