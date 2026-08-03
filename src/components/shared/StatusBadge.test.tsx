import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge, type StatusBadgeConfigEntry } from "./StatusBadge";

type Status = "active" | "paused";

const CONFIG: Record<Status, StatusBadgeConfigEntry> = {
  active: { label: "Active", variant: "success" },
  paused: {
    label: "Paused",
    variant: "warning",
    icon: <svg data-testid="icon" />,
  },
};

describe("StatusBadge", () => {
  it("renders the configured label and variant for the status", () => {
    const { getByText } = render(
      <StatusBadge config={CONFIG} status="active" />,
    );

    const badge = getByText("Active").closest("[data-slot='badge']");
    expect(badge).toHaveAttribute("data-variant", "success");
  });

  it("prepends the label prefix and renders the icon", () => {
    const { getByText, getByTestId } = render(
      <StatusBadge config={CONFIG} labelPrefix="Origin" status="paused" />,
    );

    expect(getByText("Origin Paused")).toBeInTheDocument();
    expect(getByTestId("icon")).toBeInTheDocument();
  });

  it("passes the title through to the badge", () => {
    const { getByText } = render(
      <StatusBadge config={CONFIG} status="active" title="Route is live" />,
    );

    const badge = getByText("Active").closest("[data-slot='badge']");
    expect(badge).toHaveAttribute("title", "Route is live");
  });
});
