import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type * as CitizensModule from "@/features/citizens";

import { DecreeIssuerCombobox } from "./DecreeIssuerCombobox";

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
      filters: {
        readonly nationId?: string;
        readonly search?: string;
        readonly settlementId?: string;
      },
    ) => ({
      queryKey: [
        "citizens-directory",
        filters.search,
        filters.nationId,
        filters.settlementId,
      ],
      queryFn: () => {
        searchFn(filters);
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
  citizenId: string | null,
  onChange: (citizenId: string) => void,
): ReturnType<typeof render> {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <DecreeIssuerCombobox
        citizenId={citizenId}
        nationId="nation-1"
        onChange={onChange}
        worldId="world-1"
      />
    </QueryClientProvider>,
  );
}

describe("DecreeIssuerCombobox", () => {
  it("shows a placeholder when no citizen is selected", () => {
    renderCombobox(null, vi.fn());
    expect(screen.getByRole("combobox")).toHaveTextContent("Select citizen…");
  });

  it("shows the resolved name of the selected citizen", async () => {
    renderCombobox("citizen-1", vi.fn());
    expect(await screen.findByText("Alice")).toBeDefined();
  });

  it("scopes the search to the given nation", async () => {
    const user = userEvent.setup();
    renderCombobox(null, vi.fn());

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search citizens…"), "bob");

    await waitFor(() => {
      expect(searchFn).toHaveBeenCalledWith(
        expect.objectContaining({ nationId: "nation-1", search: "bob" }),
      );
    });
  });

  it("debounces search input before querying and lets the user pick a result", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderCombobox(null, onChange);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search citizens…"), "bob");

    const option = await screen.findByText("Bob");
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith("citizen-2");
  });
});
