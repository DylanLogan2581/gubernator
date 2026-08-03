import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flag } from "lucide-react";
import { describe, expect, it } from "vitest";

import { LoreImageAvatar } from "./LoreImageAvatar";

describe("LoreImageAvatar", () => {
  it("renders a plain decorative image when not interactive", () => {
    render(
      <LoreImageAvatar
        aspectClassName="aspect-[3/2]"
        label="Aldoria flag"
        paletteSeed="seed"
        placeholder={Flag}
        url="https://example.test/flag.png"
      />,
    );

    expect(
      screen.queryByRole("button", { name: /view.*flag/i }),
    ).not.toBeInTheDocument();
  });

  it("opens a lightbox dialog with the full-size image when clicked", async () => {
    const user = userEvent.setup();
    render(
      <LoreImageAvatar
        aspectClassName="aspect-[3/2]"
        interactive
        label="Aldoria flag"
        paletteSeed="seed"
        placeholder={Flag}
        url="https://example.test/flag.png"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "View Aldoria flag full size" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Aldoria flag" }),
    ).toBeInTheDocument();
  });

  it("falls back to the placeholder glyph when there is no url", () => {
    render(
      <LoreImageAvatar
        aspectClassName="aspect-square"
        interactive
        label="Aldoria seal"
        paletteSeed="seed"
        placeholder={Flag}
        url={null}
      />,
    );

    // The trigger still renders (so a manager can open/upload), but no <img>.
    expect(
      screen.getByRole("button", { name: "View Aldoria seal full size" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
