import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorldContextBar } from "./WorldContextBar";

import type { JSX, ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    to,
  }: {
    readonly children: ReactNode;
    readonly params?: Readonly<Record<string, string>>;
    readonly to: string;
  }) => {
    const href =
      params === undefined
        ? to
        : Object.entries(params).reduce(
            (path, [name, value]) => path.replace(`$${name}`, value),
            to,
          );
    return <a href={href}>{children}</a>;
  },
  useParams: vi.fn().mockReturnValue({}),
}));

function renderBar(ui: JSX.Element): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("WorldContextBar", () => {
  it("renders the outer region with the expected aria-label", () => {
    renderBar(<WorldContextBar worldId="w1" worldName="Verdant Reach" />);
    expect(screen.getByLabelText("Active world context")).toBeDefined();
  });

  it("shows the world name in the breadcrumb", () => {
    renderBar(<WorldContextBar worldId="w1" worldName="Verdant Reach" />);
    expect(screen.getByText("Verdant Reach")).toBeDefined();
  });

  it("renders children in the right slot", () => {
    renderBar(
      <WorldContextBar worldId="w1" worldName="Verdant Reach">
        <span>Right slot</span>
      </WorldContextBar>,
    );
    expect(screen.getByText("Right slot")).toBeDefined();
  });
});
