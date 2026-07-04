import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MasterDetailLayout } from "./MasterDetailLayout";

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe("MasterDetailLayout", () => {
  afterEach(() => {
    setViewportWidth(1024);
  });

  it("renders the list without a detail panel when nothing is selected", () => {
    render(
      <MasterDetailLayout
        list={<div>the list</div>}
        detail={null}
        detailTitle="Nothing"
        onCloseDetail={vi.fn()}
      />,
    );

    expect(screen.getByText("the list")).toBeDefined();
    expect(screen.queryByText("Nothing")).toBeNull();
  });

  it("renders the detail panel inline as a Card on wide screens", () => {
    setViewportWidth(1280);

    render(
      <MasterDetailLayout
        list={<div>the list</div>}
        detail={<div>detail content</div>}
        detailTitle="Selected item"
        onCloseDetail={vi.fn()}
      />,
    );

    expect(screen.getByText("the list")).toBeDefined();
    expect(screen.getByText("Selected item")).toBeDefined();
    expect(screen.getByText("detail content")).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("moves the detail panel into a Sheet on narrow screens", () => {
    setViewportWidth(500);

    render(
      <MasterDetailLayout
        list={<div>the list</div>}
        detail={<div>detail content</div>}
        detailTitle="Selected item"
        onCloseDetail={vi.fn()}
      />,
    );

    expect(screen.getByText("the list")).toBeDefined();
    const sheet = screen.getByRole("dialog", { name: "Selected item" });
    expect(sheet).toBeDefined();
    expect(screen.getByText("detail content")).toBeDefined();
  });

  it("closing the Sheet on narrow screens calls onCloseDetail", async () => {
    setViewportWidth(500);
    const user = userEvent.setup();
    const onCloseDetail = vi.fn();

    render(
      <MasterDetailLayout
        list={<div>the list</div>}
        detail={<div>detail content</div>}
        detailTitle="Selected item"
        onCloseDetail={onCloseDetail}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Selected item" });
    await user.click(
      dialog.querySelector('[data-slot="sheet-close"]') as HTMLElement,
    );

    expect(onCloseDetail).toHaveBeenCalledOnce();
  });
});
