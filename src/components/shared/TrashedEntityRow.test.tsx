import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TrashedEntityRow } from "./TrashedEntityRow";

describe("TrashedEntityRow", () => {
  it("opens a confirm dialog naming the entity when delete permanently is clicked", async () => {
    const user = userEvent.setup();
    const onHardDelete = vi.fn();
    render(
      <TrashedEntityRow
        name="Cattle Ranch"
        isPending={false}
        onRestore={vi.fn()}
        onHardDelete={onHardDelete}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Permanently delete Cattle Ranch?",
    });
    expect(dialog).toHaveTextContent(/cannot be undone/i);
    expect(onHardDelete).not.toHaveBeenCalled();
  });

  it("does not call onHardDelete when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    const onHardDelete = vi.fn();
    render(
      <TrashedEntityRow
        name="Cattle Ranch"
        isPending={false}
        onRestore={vi.fn()}
        onHardDelete={onHardDelete}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Permanently delete Cattle Ranch?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("alertdialog", {
          name: "Permanently delete Cattle Ranch?",
        }),
      ).toBeNull();
    });
    expect(onHardDelete).not.toHaveBeenCalled();
  });

  it("calls onHardDelete only after the dialog is confirmed", async () => {
    const user = userEvent.setup();
    const onHardDelete = vi.fn();
    render(
      <TrashedEntityRow
        name="Cattle Ranch"
        isPending={false}
        onRestore={vi.fn()}
        onHardDelete={onHardDelete}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Permanently delete Cattle Ranch?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Delete permanently" }),
    );

    expect(onHardDelete).toHaveBeenCalledOnce();
  });
});
