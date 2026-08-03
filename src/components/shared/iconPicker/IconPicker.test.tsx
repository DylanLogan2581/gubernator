import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { IconPicker } from "./IconPicker";

describe("IconPicker", () => {
  // jsdom never lays out elements, so the game-icons grid's
  // `@tanstack/react-virtual` container measures a 0px viewport and renders
  // no rows. Stub a real height so its virtualized rows mount for these tests.
  let offsetHeightSpy: MockInstance<() => number>;

  beforeEach(() => {
    offsetHeightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(224);
  });

  afterEach(() => {
    offsetHeightSpy.mockRestore();
  });

  it("shows a placeholder when value is null", () => {
    render(<IconPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Choose icon…");
  });

  it("shows the formatted label when a value is selected", () => {
    render(<IconPicker value="cup-soda" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Cup Soda");
  });

  it("opens the popover and filters icons by search", async () => {
    const user = userEvent.setup();
    render(<IconPicker value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search icons…"), "wheat");

    expect(screen.getByRole("option", { name: "Wheat" })).toBeDefined();
    expect(screen.queryByRole("option", { name: "Apple" })).toBeNull();
  });

  it("calls onChange with the selected icon name and closes the popover", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value={null} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search icons…"), "wheat");
    await user.click(screen.getByRole("option", { name: "Wheat" }));

    expect(onChange).toHaveBeenCalledWith("wheat");
    expect(screen.queryByPlaceholderText("Search icons…")).toBeNull();
  });

  it("offers a clear option only when a value is already selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value="wheat" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");
    await user.click(within(listbox).getByText("Clear icon"));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders no clear option when value is null", async () => {
    const user = userEvent.setup();
    render(<IconPicker value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByText("Clear icon")).toBeNull();
  });

  it("switches to the Game Icons tab and selects a namespaced icon", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value={null} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("tab", { name: "Game Icons" }));
    await user.type(
      await screen.findByPlaceholderText(
        "Search game icons…",
        {},
        { timeout: 5000 },
      ),
      "anvil",
    );

    const option = await screen.findByRole(
      "option",
      { name: "Anvil" },
      { timeout: 5000 },
    );
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith("game:anvil");
    expect(screen.queryByPlaceholderText("Search icons…")).toBeNull();
  }, 10000);

  it("shows the formatted label for a namespaced game icon value", () => {
    render(<IconPicker value="game:anvil" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Anvil");
  });

  it("matches game icons by word regardless of query word order", async () => {
    const user = userEvent.setup();
    render(<IconPicker value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("tab", { name: "Game Icons" }));
    await user.type(
      await screen.findByPlaceholderText(
        "Search game icons…",
        {},
        { timeout: 5000 },
      ),
      "spear thrown",
    );

    expect(
      await screen.findByRole("option", { name: "Thrown Spear" }),
    ).toBeDefined();
  }, 10000);
});
