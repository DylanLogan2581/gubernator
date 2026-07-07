import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HomeFooterSection } from "./HomeFooterSection";

import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
  }: {
    readonly children: ReactNode;
    readonly to: string;
  }) => <a href={to}>{children}</a>,
}));

describe("HomeFooterSection", () => {
  it("renders a sign-in link", () => {
    render(<HomeFooterSection />);
    const link = screen.getByRole("link", { name: /sign in to play/i });
    expect(link.getAttribute("href")).toBe("/sign-in");
  });
});
