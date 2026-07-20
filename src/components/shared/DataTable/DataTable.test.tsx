import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTable } from "./DataTable";

import type { ColumnDef, SortingState } from "@tanstack/react-table";

type Row = { readonly id: string; readonly name: string; readonly age: number };

const ROWS: readonly Row[] = [
  { id: "1", age: 30, name: "Ada" },
  { id: "2", age: 20, name: "Bram" },
];

const COLUMNS: ColumnDef<Row, unknown>[] = [
  { id: "name", accessorKey: "name", header: "Name" },
  { id: "age", accessorKey: "age", header: "Age" },
  { id: "status", enableSorting: false, header: "Status", cell: () => "ok" },
];

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe("DataTable", () => {
  afterEach(() => {
    setViewportWidth(1024);
  });

  it("renders column headers and row data", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(row) => row.id}
        sorting={[]}
        onSortingChange={vi.fn()}
        pageIndex={0}
        pageCount={1}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByText("Ada")).toBeDefined();
    expect(screen.getByText("Bram")).toBeDefined();
  });

  it("renders an empty message when there are no rows", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={[]}
        getRowId={(row: Row) => row.id}
        sorting={[]}
        onSortingChange={vi.fn()}
        pageIndex={0}
        pageCount={1}
        onPageChange={vi.fn()}
        emptyMessage="Nothing here"
      />,
    );

    expect(screen.getByText("Nothing here")).toBeDefined();
  });

  it("does not render a sort control for columns with sorting disabled", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(row) => row.id}
        sorting={[]}
        onSortingChange={vi.fn()}
        pageIndex={0}
        pageCount={1}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Status" })).toBeNull();
  });

  it("toggles ascending then descending sort when a sortable header is clicked", async () => {
    const onSortingChange = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(row) => row.id}
        sorting={[]}
        onSortingChange={onSortingChange}
        pageIndex={0}
        pageCount={1}
        onPageChange={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Name/ }));
    expect(onSortingChange).toHaveBeenLastCalledWith([
      { id: "name", desc: false },
    ]);

    const nextSorting: SortingState = [{ id: "name", desc: false }];
    rerender(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(row) => row.id}
        sorting={nextSorting}
        onSortingChange={onSortingChange}
        pageIndex={0}
        pageCount={1}
        onPageChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Name/ }));
    expect(onSortingChange).toHaveBeenLastCalledWith([
      { id: "name", desc: true },
    ]);
  });

  it("marks the sorted column header with aria-sort", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(row) => row.id}
        sorting={[{ id: "age", desc: true }]}
        onSortingChange={vi.fn()}
        pageIndex={0}
        pageCount={1}
        onPageChange={vi.fn()}
      />,
    );

    expect(
      screen
        .getByRole("columnheader", { name: /Age/ })
        .getAttribute("aria-sort"),
    ).toBe("descending");
  });

  it("wraps the first cell in the provided row link", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(row) => row.id}
        sorting={[]}
        onSortingChange={vi.fn()}
        pageIndex={0}
        pageCount={1}
        onPageChange={vi.fn()}
        renderRowLink={(row, children) => (
          <a href={`/rows/${row.id}`}>{children}</a>
        )}
      />,
    );

    const link = screen.getByRole("link", { name: "Ada" });
    expect(link.getAttribute("href")).toBe("/rows/1");
  });

  it("right-aligns the header and cell for a column with meta.align right", () => {
    const columns: ColumnDef<Row, unknown>[] = [
      { id: "name", accessorKey: "name", header: "Name" },
      {
        id: "age",
        accessorKey: "age",
        header: "Age",
        meta: { align: "right" },
      },
    ];
    render(
      <DataTable
        columns={columns}
        data={ROWS}
        getRowId={(row) => row.id}
        sorting={[]}
        onSortingChange={vi.fn()}
        pageIndex={0}
        pageCount={1}
        onPageChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("columnheader", { name: /Age/ }).className,
    ).toContain("text-right");
    expect(screen.getByText("30").className).toContain("text-right");
  });

  it("calls onPageChange from the pagination control", async () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(row) => row.id}
        sorting={[]}
        onSortingChange={vi.fn()}
        pageIndex={0}
        pageCount={3}
        onPageChange={onPageChange}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Go to last page/ }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("renders mobile cards instead of the table on narrow viewports", () => {
    setViewportWidth(500);

    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(row) => row.id}
        sorting={[]}
        onSortingChange={vi.fn()}
        pageIndex={0}
        pageCount={1}
        onPageChange={vi.fn()}
        renderMobileCard={(row) => <div>Card: {row.name}</div>}
      />,
    );

    expect(screen.getByText("Card: Ada")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("still renders the table on narrow viewports when no mobile card is provided", () => {
    setViewportWidth(500);

    render(
      <DataTable
        columns={COLUMNS}
        data={ROWS}
        getRowId={(row) => row.id}
        sorting={[]}
        onSortingChange={vi.fn()}
        pageIndex={0}
        pageCount={1}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("table")).toBeDefined();
  });
});
