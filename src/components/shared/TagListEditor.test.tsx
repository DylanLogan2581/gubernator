import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import { TagListEditor } from "./TagListEditor";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("TagListEditor", () => {
  it("renders the label and entries as chips", () => {
    render(
      <TagListEditor
        label="Test pool"
        entries={["alpha", "beta"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Test pool/)).toBeDefined();
    expect(screen.getByText("alpha")).toBeDefined();
    expect(screen.getByText("beta")).toBeDefined();
  });

  it("shows empty state when there are no entries", () => {
    render(
      <TagListEditor label="Empty pool" entries={[]} onChange={vi.fn()} />,
    );
    expect(screen.getByText("No entries yet.")).toBeDefined();
  });

  it("calls onChange with a new entry appended when Add entry is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagListEditor label="Pool" entries={["alpha"]} onChange={onChange} />,
    );
    await user.type(
      screen.getByRole("textbox", { name: "Add pool entry" }),
      "beta",
    );
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    expect(onChange).toHaveBeenCalledWith(["alpha", "beta"]);
  });

  it("appends a new entry when Enter is pressed in the add-entry input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagListEditor label="Pool" entries={[]} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Add pool entry" });
    await user.type(input, "gamma{Enter}");
    expect(onChange).toHaveBeenCalledWith(["gamma"]);
  });

  it("calls onChange with entry removed when its remove button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagListEditor
        label="Pool"
        entries={["alpha", "beta"]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove entry 1" }));
    expect(onChange).toHaveBeenCalledWith(["beta"]);
  });

  it("clicking a chip lets you edit its value, committed on Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagListEditor label="Pool" entries={["alpha"]} onChange={onChange} />,
    );
    await user.click(screen.getByRole("button", { name: "Edit alpha" }));
    const editInput = screen.getByRole("textbox", {
      name: "Edit entry 1",
    });
    await user.clear(editInput);
    await user.type(editInput, "renamed{Enter}");
    expect(onChange).toHaveBeenCalledWith(["renamed"]);
  });

  it("clearing a chip's value while editing removes the entry", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagListEditor
        label="Pool"
        entries={["alpha", "beta"]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Edit alpha" }));
    const editInput = screen.getByRole("textbox", {
      name: "Edit entry 1",
    });
    await user.clear(editInput);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(["beta"]);
  });

  it("displays entry count next to label", () => {
    render(
      <TagListEditor
        label="Pool"
        entries={["a", "b", "c"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("(3)")).toBeDefined();
  });

  it("Add entry button is disabled when the input is empty", () => {
    render(<TagListEditor label="Pool" entries={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Add entry" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  describe("bulk import", () => {
    it("adds newline and comma separated entries, trimmed and deduped", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <TagListEditor label="Pool" entries={["alpha"]} onChange={onChange} />,
      );
      await user.click(screen.getByRole("button", { name: "Bulk import" }));
      await user.type(
        screen.getByRole("textbox", {
          name: "Bulk import entries — one per line",
        }),
        " beta ,gamma\nalpha\nbeta",
      );
      await user.click(screen.getByRole("button", { name: "Apply" }));
      expect(onChange).toHaveBeenCalledWith(["alpha", "beta", "gamma"]);
      expect(toast.success).toHaveBeenCalledWith(
        "Added 2 entries. Skipped 2 duplicate.",
        undefined,
      );
    });

    it("skips entries longer than maxEntryLength", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <TagListEditor
          label="Pool"
          entries={[]}
          maxEntryLength={5}
          onChange={onChange}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Bulk import" }));
      await user.type(
        screen.getByRole("textbox", {
          name: "Bulk import entries — one per line",
        }),
        "short\ntoolongvalue",
      );
      await user.click(screen.getByRole("button", { name: "Apply" }));
      expect(onChange).toHaveBeenCalledWith(["short"]);
      expect(toast.success).toHaveBeenCalledWith(
        "Added 1 entry. Skipped 1 too long.",
        undefined,
      );
    });

    it("caps added entries at maxPoolSize and reports skipped count", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <TagListEditor
          label="Pool"
          entries={["existing"]}
          maxPoolSize={2}
          onChange={onChange}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Bulk import" }));
      await user.type(
        screen.getByRole("textbox", {
          name: "Bulk import entries — one per line",
        }),
        "alpha\nbeta",
      );
      await user.click(screen.getByRole("button", { name: "Apply" }));
      expect(onChange).toHaveBeenCalledWith(["existing", "alpha"]);
      expect(toast.success).toHaveBeenCalledWith(
        "Added 1 entry. Skipped 1 — pool limit reached.",
        undefined,
      );
    });

    it("shows an error toast and does not call onChange when everything is a duplicate", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <TagListEditor label="Pool" entries={["alpha"]} onChange={onChange} />,
      );
      await user.click(screen.getByRole("button", { name: "Bulk import" }));
      await user.type(
        screen.getByRole("textbox", {
          name: "Bulk import entries — one per line",
        }),
        "alpha",
      );
      await user.click(screen.getByRole("button", { name: "Apply" }));
      expect(onChange).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        "Added 0 entries. Skipped 1 duplicate.",
        undefined,
      );
    });
  });
});
