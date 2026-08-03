import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EntityDetailsSection } from "./EntityDetailsSection";

type OnSave = React.ComponentProps<typeof EntityDetailsSection>["onSave"];

function renderSection(
  props: Partial<React.ComponentProps<typeof EntityDetailsSection>> = {},
): ReturnType<typeof vi.fn<OnSave>> {
  const onSave = vi.fn<OnSave>();
  render(
    <EntityDetailsSection
      canEdit
      descriptionMaxLength={500}
      entityLabel="Nation"
      idPrefix="nation"
      initialDescription="A place."
      initialName="Rome"
      isSaving={false}
      nameMaxLength={80}
      onSave={onSave}
      {...props}
    />,
  );
  return onSave;
}

describe("EntityDetailsSection", () => {
  it("shows the description in view mode and an edit button when editable", () => {
    renderSection();
    expect(screen.getByText("A place.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("hides the edit button when not editable", () => {
    renderSection({ canEdit: false });
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("shows a placeholder when there is no description", () => {
    renderSection({ initialDescription: null });
    expect(screen.getByText("No description.")).toBeInTheDocument();
  });

  it("validates that the name is required using the entity label", () => {
    const onSave = renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "  " },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Edit nation details" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nation name is required.",
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onSave with trimmed-to-null description on submit", () => {
    const onSave = renderSection({ initialDescription: null });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Carthage" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Edit nation details" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const call = onSave.mock.calls[0];
    expect(call?.[0]).toEqual({ name: "Carthage", description: null });
    expect(typeof call?.[1].onSuccess).toBe("function");
  });
});
