import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PoolEditor } from "./PoolEditor";

describe("PoolEditor", () => {
  it("renders the label and entries", () => {
    render(
      <PoolEditor
        label="Test pool"
        entries={["alpha", "beta"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Test pool/)).toBeDefined();
    expect(screen.getByDisplayValue("alpha")).toBeDefined();
    expect(screen.getByDisplayValue("beta")).toBeDefined();
  });

  it("shows empty state when there are no entries", () => {
    render(<PoolEditor label="Empty pool" entries={[]} onChange={vi.fn()} />);
    expect(screen.getByText("No entries yet.")).toBeDefined();
  });

  it("calls onChange with new empty entry when Add entry is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PoolEditor label="Pool" entries={["alpha"]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    expect(onChange).toHaveBeenCalledWith(["alpha", ""]);
  });

  it("calls onChange with entry removed when remove button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PoolEditor
        label="Pool"
        entries={["alpha", "beta"]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove entry 1" }));
    expect(onChange).toHaveBeenCalledWith(["beta"]);
  });

  it("pressing Enter on the last input appends a new empty entry", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PoolEditor
        label="Pool"
        entries={["alpha", "beta"]}
        onChange={onChange}
      />,
    );
    const lastInput = screen.getByDisplayValue("beta");
    await user.click(lastInput);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(["alpha", "beta", ""]);
  });

  it("pressing Enter on a non-last input does not append a new entry", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PoolEditor
        label="Pool"
        entries={["alpha", "beta"]}
        onChange={onChange}
      />,
    );
    const firstInput = screen.getByDisplayValue("alpha");
    await user.click(firstInput);
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens a dialog with the pool label when Bulk import is clicked", async () => {
    const user = userEvent.setup();
    render(<PoolEditor label="Pool" entries={[]} onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Bulk import/ }));
    expect(
      screen.getByRole("dialog", { name: /Bulk import — Pool/ }),
    ).toBeDefined();
    expect(
      screen.getByRole("textbox", {
        name: /Bulk import entries/,
      }),
    ).toBeDefined();
  });

  it("bulk import appends trimmed, deduplicated entries", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PoolEditor label="Pool" entries={["alpha"]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /Bulk import/ }));
    const textarea = screen.getByRole("textbox", {
      name: /Bulk import entries/,
    });
    await user.type(textarea, "  beta  \nalpha\ngamma\nbeta");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(onChange).toHaveBeenCalledWith(["alpha", "beta", "gamma"]);
  });

  it("Apply button is disabled when bulk textarea is empty", async () => {
    const user = userEvent.setup();
    render(<PoolEditor label="Pool" entries={[]} onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Bulk import/ }));
    expect(screen.getByRole("button", { name: "Apply" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("Cancel button hides the bulk import textarea", async () => {
    const user = userEvent.setup();
    render(<PoolEditor label="Pool" entries={[]} onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Bulk import/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("textbox", { name: /Bulk import entries/ }),
    ).toBeNull();
  });

  it("displays entry count next to label", () => {
    render(
      <PoolEditor label="Pool" entries={["a", "b", "c"]} onChange={vi.fn()} />,
    );
    expect(screen.getByText("(3)")).toBeDefined();
  });
});
