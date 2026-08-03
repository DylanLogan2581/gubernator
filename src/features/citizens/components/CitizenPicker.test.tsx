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
      readonly settlementId?: string;
      readonly status?: string;
    },
  ) => ({
    queryKey: [
      "citizens-directory",
      filters.search,
      filters.citizenType,
      filters.settlementId,
      filters.status,
    ],
    queryFn: () => {
      searchFn(filters);
      const rows = [
        {
          citizenType: "player_character",
          id: "citizen-1",
          name: "Alice",
          officeTypes: null,
          settlementName: "Riverside",
          status: "alive",
        },
        {
          citizenType: "npc",
          id: "citizen-2",
          name: "Bob",
          officeTypes: null,
          settlementName: "Riverside",
          status: "dead",
        },
        {
          citizenType: "player_character",
          id: "citizen-3",
          name: "Deirdre Dunmore",
          officeTypes: "Settlement Manager",
          settlementName: "Riverside",
          status: "alive",
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

vi.mock("../queries/citizensQueries", () => ({
  citizenByIdQueryOptions: (citizenId: string) => ({
    queryKey: ["citizen-by-id", citizenId],
    queryFn: () =>
      Promise.resolve(
        citizenId === "citizen-1" ? { id: citizenId, name: "Alice" } : null,
      ),
  }),
}));

function renderPicker(
  citizenId: string | null,
  onChange: (citizenId: string | null) => void,
  props: { readonly settlementId?: string } = {},
): ReturnType<typeof render> {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CitizenPicker
        citizenId={citizenId}
        nationId="nation-1"
        onChange={onChange}
        worldId="world-1"
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("CitizenPicker", () => {
  it("shows a placeholder when no citizen is selected", () => {
    renderPicker(null, vi.fn());
    expect(screen.getByRole("combobox")).toHaveTextContent("Select citizen…");
  });

  it("shows the resolved name of the selected citizen in the trigger", async () => {
    renderPicker("citizen-1", vi.fn());
    expect(await screen.findByText("Alice")).toBeDefined();
  });

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

  it("scopes the search to a settlement when provided", async () => {
    const user = userEvent.setup();
    renderPicker(null, vi.fn(), { settlementId: "settlement-1" });

    await user.click(screen.getByRole("combobox"));

    await waitFor(() => {
      expect(searchFn).toHaveBeenCalledWith(
        expect.objectContaining({ settlementId: "settlement-1" }),
      );
    });
  });

  it("shows settlement and role metadata per result row, distinguishing duplicate names", async () => {
    const user = userEvent.setup();
    renderPicker(null, vi.fn());

    await user.click(screen.getByRole("combobox"));

    expect(
      await screen.findAllByText("Riverside", { exact: false }),
    ).not.toHaveLength(0);
    expect(screen.getByText("Dead")).toBeDefined();
    expect(screen.getByText(/Settlement Manager/)).toBeDefined();
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

  it("clears the staged selection from the trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker("citizen-1", onChange);

    await screen.findByText("Alice");
    await user.click(screen.getByRole("button", { name: "Clear selection" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("clears the staged selection from the list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker("citizen-1", onChange);

    await screen.findByText("Alice");
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Clear selection"));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("does not render a clear affordance when nothing is selected", () => {
    renderPicker(null, vi.fn());
    expect(
      screen.queryByRole("button", { name: "Clear selection" }),
    ).toBeNull();
  });
});
