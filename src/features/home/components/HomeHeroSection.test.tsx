import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HomeHeroSection } from "./HomeHeroSection";

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

describe("HomeHeroSection", () => {
  it("renders the product name as the page heading", () => {
    render(<HomeHeroSection />);
    expect(
      screen.getByRole("heading", { name: "Gubernator", level: 1 }),
    ).toBeDefined();
  });

  it("describes the game with a one-line pitch", () => {
    render(<HomeHeroSection />);
    expect(screen.getByText(/turn-based world simulation game/i)).toBeDefined();
  });

  it("renders a sign-in call to action linking to sign-in", () => {
    render(<HomeHeroSection />);
    const cta = screen.getByRole("link", { name: /sign in to play/i });
    expect(cta.getAttribute("href")).toBe("/sign-in");
  });
});
