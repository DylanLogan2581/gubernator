import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CitizenPicker } from "./CitizenPicker";

const searchFn = vi.fn();

vi.mock("../queries/citizenDirectoryQueries", () => ({
  citizensDirectoryQueryOptions: (
    _worldId: string,
    filters: {
      readonly citizenType?: string;
      readonly nationId?: string;
      readonly search?: string;
      readonly status?: string;
    },
  ) => ({
    queryKey: [
      "citizens-directory",
      filters.search,
      filters.citizenType,
      filters.status,
    ],
    queryFn: () => {
      searchFn(filters);
      const rows = [
        {
          citizenType: "player_character",
          id: "citizen-1",
          name: "Alice",
          settlementName: "Riverside",
          status: "alive",
        },
        {
          citizenType: "npc",
          id: "citizen-2",
          name: "Bob",
          settlementName: "Riverside",
          status: "dead",
        },
      ]
        .filter((row) =>
          filters.search !== undefined && filters.search !== ""
            ? row.name.toLowerCase().includes(filters.search.toLowerCase())
            : true,
        )
        .filter((row) =>
          filters.citizenType === undefined
            ? true
            : row.citizenType === filters.citizenType,
        )
        .filter((row) =>
          filters.status === undefined ? true : row.status === filters.status,
        );
      return Promise.resolve({ rows, totalCount: rows.length });
    },
  }),
}));

function renderPicker(
  citizenId: string | null,
  onChange: (citizenId: string) => void,
): ReturnType<typeof render> {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CitizenPicker
        citizenId={citizenId}
        nationId="nation-1"
        onChange={onChange}
        worldId="world-1"
      />
    </QueryClientProvider>,
  );
}

describe("CitizenPicker", () => {
  it("searches server-side with debounce as the admin types", async () => {
    const user = userEvent.setup();
    renderPicker(null, vi.fn());

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search citizens…"), "bob");

    await waitFor(() => {
      expect(searchFn).toHaveBeenCalledWith(
        expect.objectContaining({ search: "bob" }),
      );
    });
    expect(await screen.findByText("Bob")).toBeDefined();
  });

  it("shows settlement and status metadata per result row", async () => {
    const user = userEvent.setup();
    renderPicker(null, vi.fn());

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findAllByText("Riverside")).toHaveLength(2);
    expect(screen.getByText("Dead")).toBeDefined();
  });

  it("filters to players only via the type toggle", async () => {
    const user = userEvent.setup();
    renderPicker(null, vi.fn());

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("radio", { name: "Players only" }));

    await waitFor(() => {
      expect(searchFn).toHaveBeenCalledWith(
        expect.objectContaining({ citizenType: "player_character" }),
      );
    });
  });

  it("filters to NPCs only via the type toggle", async () => {
    const user = userEvent.setup();
    renderPicker(null, vi.fn());

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("radio", { name: "NPCs only" }));

    await waitFor(() => {
      expect(searchFn).toHaveBeenCalledWith(
        expect.objectContaining({ citizenType: "npc" }),
      );
    });
  });

  it("calls onChange and closes when a result is picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker(null, onChange);

    await user.click(screen.getByRole("combobox"));
    const option = await screen.findByText("Alice");
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith("citizen-1");
  });
});
