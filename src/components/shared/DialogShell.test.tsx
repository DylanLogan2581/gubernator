import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DialogShell } from "./DialogShell";

describe("DialogShell", () => {
  it("renders its children inside the overlay", () => {
    render(
      <DialogShell>
        <div data-testid="dialog-body">Dialog content</div>
      </DialogShell>,
    );

    expect(screen.getByTestId("dialog-body")).toHaveTextContent(
      "Dialog content",
    );
  });

  it("uses a fixed full-viewport scroll container so tall dialogs are reachable on short screens", () => {
    const { container } = render(
      <DialogShell>
        <div>Dialog content</div>
      </DialogShell>,
    );

    const overlay = container.firstElementChild;
    expect(overlay).not.toBeNull();
    const overlayClass = overlay?.className ?? "";
    expect(overlayClass).toContain("fixed");
    expect(overlayClass).toContain("inset-0");
    expect(overlayClass).toContain("overflow-y-auto");

    const inner = overlay?.firstElementChild;
    const innerClass = inner?.className ?? "";
    expect(innerClass).toContain("min-h-full");
    expect(innerClass).toContain("items-center");
  });
});
