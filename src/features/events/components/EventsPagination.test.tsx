import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventsPagination } from "./EventsPagination";

describe("EventsPagination", () => {
  it("is reachable via Tab and activates page links with Enter", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <EventsPagination
        pageIndex={0}
        pageCount={3}
        onPageChange={onPageChange}
      />,
    );

    await user.tab();
    expect(screen.getByLabelText("Go to previous page")).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "1" })).toHaveFocus();

    await user.tab();
    const pageTwo = screen.getByRole("button", { name: "2" });
    expect(pageTwo).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("activates on Space as well as Enter", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <EventsPagination
        pageIndex={0}
        pageCount={3}
        onPageChange={onPageChange}
      />,
    );

    screen.getByRole("button", { name: "2" }).focus();
    await user.keyboard(" ");
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("marks the previous control aria-disabled on the first page and ignores activation", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <EventsPagination
        pageIndex={0}
        pageCount={3}
        onPageChange={onPageChange}
      />,
    );

    const prev = screen.getByLabelText("Go to previous page");
    expect(prev).toHaveAttribute("aria-disabled", "true");

    prev.focus();
    expect(prev).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("marks the next control aria-disabled on the last page and ignores activation", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <EventsPagination
        pageIndex={2}
        pageCount={3}
        onPageChange={onPageChange}
      />,
    );

    const next = screen.getByLabelText("Go to next page");
    expect(next).toHaveAttribute("aria-disabled", "true");

    next.focus();
    await user.keyboard("{Enter}");
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("enables prev/next controls with aria-disabled false in the middle of the range", () => {
    render(
      <EventsPagination pageIndex={1} pageCount={3} onPageChange={vi.fn()} />,
    );

    expect(screen.getByLabelText("Go to previous page")).toHaveAttribute(
      "aria-disabled",
      "false",
    );
    expect(screen.getByLabelText("Go to next page")).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });
});
