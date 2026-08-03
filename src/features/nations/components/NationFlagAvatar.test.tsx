import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NationFlagAvatar } from "./NationFlagAvatar";

const { mockUseNationImageSignedUrl } = vi.hoisted(() => ({
  mockUseNationImageSignedUrl: vi.fn(),
}));

vi.mock("../queries/nationImageQueries", () => ({
  useNationImageSignedUrl: mockUseNationImageSignedUrl,
}));

const NATION_ID = "11111111-1111-1111-1111-111111111111";

describe("NationFlagAvatar", () => {
  beforeEach(() => {
    mockUseNationImageSignedUrl.mockReset();
    mockUseNationImageSignedUrl.mockReturnValue({
      isLoading: false,
      url: "https://example.test/flag.png",
    });
  });

  it("renders as a plain decorative image when not interactive", () => {
    render(
      <NationFlagAvatar flagPath="flags/aldoria.png" nationId={NATION_ID} />,
    );

    expect(
      screen.queryByRole("button", { name: /view.*flag/i }),
    ).not.toBeInTheDocument();
  });

  it("opens a lightbox dialog with the full-size flag when clicked", async () => {
    const user = userEvent.setup();
    render(
      <NationFlagAvatar
        flagPath="flags/aldoria.png"
        interactive
        nationId={NATION_ID}
        nationName="Aldoria"
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "View Aldoria flag full size",
    });
    await user.click(trigger);

    expect(
      await screen.findByRole("dialog", { name: "Aldoria flag" }),
    ).toBeInTheDocument();
  });

  it("is keyboard accessible via the button's native activation", async () => {
    const user = userEvent.setup();
    render(
      <NationFlagAvatar
        flagPath="flags/aldoria.png"
        interactive
        nationId={NATION_ID}
        nationName="Aldoria"
      />,
    );

    await user.tab();
    expect(
      screen.getByRole("button", { name: "View Aldoria flag full size" }),
    ).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("dialog", { name: "Aldoria flag" }),
    ).toBeInTheDocument();
  });
});
