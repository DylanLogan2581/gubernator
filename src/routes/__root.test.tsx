import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

function renderAt(path: string): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  });
  render(<RouterProvider router={router} />);
}

describe("not-found route", () => {
  it("renders a branded fallback for unknown routes", async () => {
    renderAt("/this-route-does-not-exist");
    expect(await screen.findByText("Page not found")).toBeDefined();
  });

  it("provides a link back to home", async () => {
    renderAt("/another-missing-route");
    await screen.findByText("Page not found");
    expect(screen.getByRole("link", { name: "Go to home" })).toBeDefined();
  });

  it("does not render template copy on the fallback", async () => {
    renderAt("/no-such-page");
    await screen.findByText("Page not found");
    expect(screen.queryByText(/web application template/i)).toBeNull();
    expect(screen.queryByText(/Small demo, strong defaults/i)).toBeNull();
  });

  it("still renders the app shell around the fallback", async () => {
    renderAt("/not-a-real-route");
    await screen.findByText("Page not found");
    expect(screen.getByText("Gubernator")).toBeDefined();
  });
});
