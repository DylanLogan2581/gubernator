import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type * as CitizensModule from "@/features/citizens";

import { TurnLogCitizenCombobox } from "./TurnLogCitizenCombobox";

const searchFn = vi.fn();

vi.mock("@/features/citizens", async () => {
  const actual = await vi.importActual<typeof CitizensModule>(
    "@/features/citizens",
  );
  return {
    ...actual,
    citizenByIdQueryOptions: (citizenId: string) => ({
      queryKey: ["citizen-by-id", citizenId],
      queryFn: () =>
        Promise.resolve(
          citizenId === "citizen-1" ? { id: citizenId, name: "Alice" } : null,
        ),
    }),
    citizensDirectoryQueryOptions: (
      _worldId: string,
      filters: { readonly search?: string },
    ) => ({
      queryKey: ["citizens-directory", filters.search],
      queryFn: () => {
        searchFn(filters.search);
        const rows = [
          { id: "citizen-1", name: "Alice" },
          { id: "citizen-2", name: "Bob" },
        ].filter((row) =>
          filters.search !== undefined && filters.search !== ""
            ? row.name.toLowerCase().includes(filters.search.toLowerCase())
            : true,
        );
        return Promise.resolve({ rows, totalCount: rows.length });
      },
    }),
  };
});

function renderCombobox(
  citizenId: string | undefined,
  onChange: (citizenId: string | undefined) => void,
): ReturnType<typeof render> {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <TurnLogCitizenCombobox
        citizenId={citizenId}
        onChange={onChange}
        worldId="world-1"
      />
    </QueryClientProvider>,
  );
}

describe("TurnLogCitizenCombobox", () => {
  it('shows "All citizens" when no citizen is selected', () => {
    renderCombobox(undefined, vi.fn());
    expect(screen.getByRole("combobox")).toHaveTextContent("All citizens");
  });

  it("shows the resolved name of the selected citizen", async () => {
    renderCombobox("citizen-1", vi.fn());
    expect(await screen.findByText("Alice")).toBeDefined();
  });

  it("debounces search input before querying and lets the user pick a result", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderCombobox(undefined, onChange);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search citizens…"), "bob");

    await waitFor(() => {
      expect(searchFn).toHaveBeenCalledWith("bob");
    });

    const option = await screen.findByText("Bob");
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith("citizen-2");
  });

  it('calling onChange with undefined when "All citizens" is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderCombobox("citizen-1", onChange);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("All citizens"));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
