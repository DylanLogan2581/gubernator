import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TablePagination } from "./TablePagination";

describe("TablePagination", () => {
  it("is reachable via Tab and activates page links with Enter", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <TablePagination page={0} pageCount={3} onPageChange={onPageChange} />,
    );

    await user.tab();
    expect(screen.getByLabelText("Go to first page")).toHaveFocus();

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
    const onPageChange = vi.fn();
    render(
      <TablePagination page={0} pageCount={3} onPageChange={onPageChange} />,
    );

    screen.getByRole("button", { name: "2" }).focus();
    await userEvent.setup().keyboard(" ");
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("marks first/previous aria-disabled on the first page and ignores activation", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <TablePagination page={0} pageCount={3} onPageChange={onPageChange} />,
    );

    const first = screen.getByLabelText("Go to first page");
    const prev = screen.getByLabelText("Go to previous page");
    expect(first).toHaveAttribute("aria-disabled", "true");
    expect(prev).toHaveAttribute("aria-disabled", "true");

    prev.focus();
    await user.keyboard("{Enter}");
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("marks next/last aria-disabled on the last page and ignores activation", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <TablePagination page={2} pageCount={3} onPageChange={onPageChange} />,
    );

    const next = screen.getByLabelText("Go to next page");
    const last = screen.getByLabelText("Go to last page");
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(last).toHaveAttribute("aria-disabled", "true");

    next.focus();
    await user.keyboard("{Enter}");
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("marks the current page with aria-current=page", () => {
    render(<TablePagination page={1} pageCount={3} onPageChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("jumps to the first and last page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <TablePagination page={5} pageCount={10} onPageChange={onPageChange} />,
    );

    await user.click(screen.getByLabelText("Go to first page"));
    expect(onPageChange).toHaveBeenCalledWith(0);

    await user.click(screen.getByLabelText("Go to last page"));
    expect(onPageChange).toHaveBeenCalledWith(9);
  });

  it("renders a bounded strip with ellipsis for a large page count instead of every page", () => {
    render(
      <TablePagination page={41} pageCount={100} onPageChange={vi.fn()} />,
    );

    expect(
      screen
        .getAllByRole("button")
        .filter((el) => /^\d+$/.test(el.textContent ?? "")),
    ).toHaveLength(5);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "41" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "42" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "43" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "100" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "50" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Page 42 of 100")).toBeInTheDocument();
  });

  it("disables all controls when isDisabled is true", () => {
    render(
      <TablePagination
        page={1}
        pageCount={3}
        onPageChange={vi.fn()}
        isDisabled
      />,
    );

    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
