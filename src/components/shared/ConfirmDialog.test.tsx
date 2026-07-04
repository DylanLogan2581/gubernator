import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("shows a pending spinner and disables actions while confirming", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete world"
        description="This cannot be undone."
        confirmLabel="Delete"
        isPending
        onConfirm={vi.fn()}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /Delete/ });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(confirmButton.querySelector(".animate-spin")).not.toBeNull();
  });

  it("does not show a spinner and allows confirming when idle", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete world"
        description="This cannot be undone."
        confirmLabel="Delete"
        isPending={false}
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "Delete" });
    expect(confirmButton).not.toBeDisabled();
    expect(confirmButton.querySelector(".animate-spin")).toBeNull();

    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
