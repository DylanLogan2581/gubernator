import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettlementFlagAvatar } from "./SettlementFlagAvatar";

const { mockUseSettlementImageSignedUrl } = vi.hoisted(() => ({
  mockUseSettlementImageSignedUrl: vi.fn(),
}));

vi.mock("../queries/settlementImageQueries", () => ({
  useSettlementImageSignedUrl: mockUseSettlementImageSignedUrl,
}));

const SETTLEMENT_ID = "22222222-2222-2222-2222-222222222222";

describe("SettlementFlagAvatar", () => {
  beforeEach(() => {
    mockUseSettlementImageSignedUrl.mockReset();
    mockUseSettlementImageSignedUrl.mockReturnValue({
      isLoading: false,
      url: "https://example.test/flag.png",
    });
  });

  it("renders as a plain decorative image when not interactive", () => {
    render(
      <SettlementFlagAvatar
        flagPath="flags/rivermouth.png"
        settlementId={SETTLEMENT_ID}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /view.*flag/i }),
    ).not.toBeInTheDocument();
  });

  it("opens a lightbox dialog with the full-size flag when clicked", async () => {
    const user = userEvent.setup();
    render(
      <SettlementFlagAvatar
        flagPath="flags/rivermouth.png"
        interactive
        settlementId={SETTLEMENT_ID}
        settlementName="Rivermouth"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "View Rivermouth flag full size" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Rivermouth flag" }),
    ).toBeInTheDocument();
  });
});
