import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailPageFrame } from "./DetailPageFrame";

describe("DetailPageFrame", () => {
  it("renders the back link and children", () => {
    render(
      <DetailPageFrame backLink={<a href="/back">Back to list</a>}>
        <p>Page content</p>
      </DetailPageFrame>,
    );
    expect(screen.getByRole("link", { name: "Back to list" })).toHaveAttribute(
      "href",
      "/back",
    );
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("appends extra classes to the back button", () => {
    render(
      <DetailPageFrame
        backButtonClassName="print:hidden"
        backLink={<a href="/back">Back</a>}
      >
        <p>Content</p>
      </DetailPageFrame>,
    );
    const link = screen.getByRole("link", { name: "Back" });
    expect(link.className).toContain("w-fit");
    expect(link.className).toContain("print:hidden");
  });
});
