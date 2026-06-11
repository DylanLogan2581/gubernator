import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Resource } from "@/features/resources";

import {
  ResourceAmountListEditor,
  type ResourceAmountEntry,
} from "./ResourceAmountListEditor";

vi.mock("@/lib/uid", () => ({
  generateLocalId: vi.fn(() => "00000000-0000-0000-0000-0000000000aa"),
}));

const RESOURCE_ID_1 = "00000000-0000-0000-0000-000000000001";
const RESOURCE_ID_2 = "00000000-0000-0000-0000-000000000002";

function createResource(overrides: Partial<Resource> = {}): Resource {
  return {
    baseStockpileCap: 1000,
    createdAt: "2026-01-01T00:00:00.000Z",
    decayRate: 0,
    id: RESOURCE_ID_1,
    isTrashed: false,
    isSystemResource: false,
    lastCleanupSummaryJson: null,
    name: "Iron",
    slug: "iron",
    updatedAt: "2026-01-01T00:00:00.000Z",
    worldId: "00000000-0000-0000-0000-000000000099",
    ...overrides,
  };
}

function createEntry(
  overrides: Partial<ResourceAmountEntry> = {},
): ResourceAmountEntry {
  return {
    amount: "1",
    id: "00000000-0000-0000-0000-0000000000ab",
    resourceId: RESOURCE_ID_1,
    ...overrides,
  };
}

const defaultProps = {
  addLabel: "Add entry",
  amountLabel: "amount per worker",
  disabled: false,
  label: "Inputs",
  onChange: vi.fn(),
  resources: [createResource()],
};

describe("ResourceAmountListEditor", () => {
  it("renders the label", () => {
    render(<ResourceAmountListEditor {...defaultProps} entries={[]} />);
    expect(screen.getByText("Inputs")).toBeDefined();
  });

  it("shows empty state when there are no entries", () => {
    render(<ResourceAmountListEditor {...defaultProps} entries={[]} />);
    expect(screen.getByText("No inputs.")).toBeDefined();
  });

  it("renders entries with amount inputs", () => {
    const entries = [createEntry({ amount: "5" })];
    render(<ResourceAmountListEditor {...defaultProps} entries={entries} />);
    expect(
      screen.getByRole("textbox", { name: "Inputs entry 1 amount per worker" }),
    ).toHaveValue("5");
  });

  it("calls onChange with new entry when add button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ResourceAmountListEditor
        {...defaultProps}
        entries={[]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    expect(onChange).toHaveBeenCalledWith([
      {
        amount: "1",
        id: "00000000-0000-0000-0000-0000000000aa",
        resourceId: RESOURCE_ID_1,
      },
    ]);
  });

  it("disables add button when all resources are already used", () => {
    const entries = [createEntry({ resourceId: RESOURCE_ID_1 })];
    render(<ResourceAmountListEditor {...defaultProps} entries={entries} />);
    expect(screen.getByRole("button", { name: "Add entry" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("disables add button when resources list is empty", () => {
    render(
      <ResourceAmountListEditor
        {...defaultProps}
        entries={[]}
        resources={[]}
      />,
    );
    expect(screen.getByRole("button", { name: "Add entry" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("calls onChange with entry removed when remove button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const resources = [
      createResource({ id: RESOURCE_ID_1, name: "Iron" }),
      createResource({ id: RESOURCE_ID_2, name: "Wood" }),
    ];
    const entries = [
      createEntry({ resourceId: RESOURCE_ID_1 }),
      createEntry({ resourceId: RESOURCE_ID_2 }),
    ];
    render(
      <ResourceAmountListEditor
        {...defaultProps}
        entries={entries}
        resources={resources}
        onChange={onChange}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Remove Inputs entry 1" }),
    );
    expect(onChange).toHaveBeenCalledWith([
      createEntry({ resourceId: RESOURCE_ID_2 }),
    ]);
  });

  it("shows fieldError when provided", () => {
    render(
      <ResourceAmountListEditor
        {...defaultProps}
        entries={[]}
        fieldError="Something went wrong"
      />,
    );
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("does not render notes input when showNotes is false", () => {
    const entries = [createEntry()];
    render(<ResourceAmountListEditor {...defaultProps} entries={entries} />);
    expect(
      screen.queryByRole("textbox", { name: "Inputs entry 1 notes" }),
    ).toBeNull();
  });

  it("renders notes input when showNotes is true", () => {
    const entries = [createEntry({ notes: "test note" })];
    render(
      <ResourceAmountListEditor
        {...defaultProps}
        entries={entries}
        showNotes={true}
      />,
    );
    expect(
      screen.getByRole("textbox", { name: "Inputs entry 1 notes" }),
    ).toHaveValue("test note");
  });

  it("shows deleted resource error when entry references a missing resource", () => {
    const entries = [
      createEntry({ resourceId: "00000000-0000-0000-0000-000000000099" }),
    ];
    render(<ResourceAmountListEditor {...defaultProps} entries={entries} />);
    expect(
      screen.getByText(
        "This resource has been deleted. Remove this row or select a different resource.",
      ),
    ).toBeDefined();
  });

  it("calls onChange with updated amount when amount input changes", () => {
    const onChange = vi.fn();
    const entries = [createEntry({ amount: "1" })];
    render(
      <ResourceAmountListEditor
        {...defaultProps}
        entries={entries}
        onChange={onChange}
      />,
    );
    const amountInput = screen.getByRole("textbox", {
      name: "Inputs entry 1 amount per worker",
    });
    fireEvent.change(amountInput, { target: { value: "5" } });
    const lastCall = onChange.mock.calls[0] as unknown as [
      readonly ResourceAmountEntry[],
    ];
    expect(lastCall[0][0]?.amount).toBe("5");
  });

  it("uses the custom addLabel in the add button", () => {
    render(
      <ResourceAmountListEditor
        {...defaultProps}
        addLabel="Add input"
        entries={[]}
      />,
    );
    expect(screen.getByRole("button", { name: "Add input" })).toBeDefined();
  });
});
