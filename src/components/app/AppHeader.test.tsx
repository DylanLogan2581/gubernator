import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("renders the Gubernator app name", () => {
    render(<AppHeader />);
    expect(screen.getByText("Gubernator")).toBeDefined();
  });

  it("renders the app description", () => {
    render(<AppHeader />);
    expect(screen.getByText(/turn-based world simulation/i)).toBeDefined();
  });

  it("renders the logo image", () => {
    render(<AppHeader />);
    expect(screen.getByAltText("Gubernator logo")).toBeDefined();
  });

  it("renders the notification bell placeholder", () => {
    render(<AppHeader />);
    expect(
      screen.getByRole("button", { name: /notifications/i }),
    ).toBeDefined();
  });
});
