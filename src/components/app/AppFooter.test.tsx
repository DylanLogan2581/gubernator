import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppFooter } from "./AppFooter";

describe("AppFooter", () => {
  it("renders the author attribution", () => {
    render(<AppFooter />);
    expect(screen.getByRole("link", { name: "Dylan Logan" })).toBeDefined();
  });

  it("renders Munduscraft attribution", () => {
    render(<AppFooter />);
    expect(screen.getByText(/Munduscraft/i)).toBeDefined();
  });

  it("links to the Gubernator GitHub repository", () => {
    render(<AppFooter />);
    expect(
      screen.getByRole("link", { name: /Gubernator on GitHub/i }),
    ).toBeDefined();
  });
});
