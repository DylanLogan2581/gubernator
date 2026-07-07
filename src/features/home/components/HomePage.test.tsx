import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HomePage } from "./HomePage";

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

describe("HomePage", () => {
  it("renders a Gubernator heading", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "Gubernator", level: 1 }),
    ).toBeDefined();
  });

  it("describes turn-based world simulation", () => {
    render(<HomePage />);
    expect(screen.getByText(/turn-based world simulation/i)).toBeDefined();
  });

  it("renders a sign-in call to action", () => {
    render(<HomePage />);
    expect(
      screen.getAllByRole("link", { name: /sign in/i }).length,
    ).toBeGreaterThan(0);
  });

  it("does not render template hero copy", () => {
    render(<HomePage />);
    expect(screen.queryByText(/web application template/i)).toBeNull();
    expect(screen.queryByText(/Small demo, strong defaults/i)).toBeNull();
  });

  it("does not render stale placeholder or roadmap copy", () => {
    render(<HomePage />);
    expect(screen.queryByText(/upcoming epics/i)).toBeNull();
    expect(screen.queryByText(/will become functional/i)).toBeNull();
    expect(screen.queryByText(/planned/i)).toBeNull();
  });

  it("does not render the demo form", () => {
    render(<HomePage />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(/TanStack Form/i)).toBeNull();
  });

  it("does not render template Supabase session demo copy", () => {
    render(<HomePage />);
    expect(screen.queryByText(/Query \+ Supabase/i)).toBeNull();
    expect(screen.queryByText(/No active session/i)).toBeNull();
  });
});
