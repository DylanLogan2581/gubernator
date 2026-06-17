import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";

import {
  SearchableResourcePicker,
  type Resource,
} from "./SearchableResourcePicker";

// Mock ResizeObserver for ScrollArea tests
beforeAll((): void => {
  class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (window as any).ResizeObserver = ResizeObserver;
  }
});

describe("SearchableResourcePicker", () => {
  const mockResources: Resource[] = [
    { id: "1", name: "Wood" },
    { id: "2", name: "Stone" },
    { id: "3", name: "Iron" },
  ];

  it("displays all resources in the list", () => {
    render(
      <SearchableResourcePicker
        resources={mockResources}
        selectedIds={[]}
        onSelectionChange={() => {}}
      />,
    );

    expect(screen.getAllByText("Wood")).toHaveLength(1);
    expect(screen.getAllByText("Stone")).toHaveLength(1);
    expect(screen.getAllByText("Iron")).toHaveLength(1);
  });

  it("filters resources by search query", async () => {
    const user = userEvent.setup();

    render(
      <SearchableResourcePicker
        resources={mockResources}
        selectedIds={[]}
        onSelectionChange={() => {}}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Search resources...");
    await user.type(searchInput, "stone");

    expect(screen.getByText("Stone")).toBeInTheDocument();
    expect(screen.queryByText("Wood")).not.toBeInTheDocument();
    expect(screen.queryByText("Iron")).not.toBeInTheDocument();
  });

  it("shows selection count", () => {
    render(
      <SearchableResourcePicker
        resources={mockResources}
        selectedIds={["1", "2"]}
        onSelectionChange={() => {}}
      />,
    );

    expect(screen.getByText("2 of 3 selected")).toBeInTheDocument();
  });

  it("shows empty state when no resources available", () => {
    render(
      <SearchableResourcePicker
        resources={[]}
        selectedIds={[]}
        onSelectionChange={() => {}}
      />,
    );

    expect(screen.getByText("No resources available")).toBeInTheDocument();
  });
});
