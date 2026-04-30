import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccessDeniedState } from "./AccessDeniedState";

describe("AccessDeniedState", () => {
  it("renders Gubernator-specific default copy", () => {
    render(<AccessDeniedState />);

    expect(
      screen.getByRole("heading", { name: "Access denied" }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "Your Gubernator account does not have access to this area.",
      ),
    ).toBeDefined();
  });

  it("renders an accessible heading and body", () => {
    render(
      <AccessDeniedState
        title="World unavailable"
        description="This world does not exist or your Gubernator account does not have access."
      />,
    );

    const heading = screen.getByRole("heading", { name: "World unavailable" });
    const status = screen.getByRole("status");

    expect(heading).toBeDefined();
    expect(status).toHaveAccessibleDescription(
      "This world does not exist or your Gubernator account does not have access.",
    );
  });
});
