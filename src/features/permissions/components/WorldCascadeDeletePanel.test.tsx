import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

import { WorldCascadeDeletePanel } from "./WorldCascadeDeletePanel";

import type { ReactNode } from "react";

// jsdom lacks pointer capture / scrollIntoView, which Radix Select needs to open.
/* eslint-disable @typescript-eslint/unbound-method */
Element.prototype.hasPointerCapture ??= function hasPointerCapture() {
  return false;
};
Element.prototype.setPointerCapture ??= function setPointerCapture() {};
Element.prototype.releasePointerCapture ??= function releasePointerCapture() {};
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
/* eslint-enable @typescript-eslint/unbound-method */

describe("WorldCascadeDeletePanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("disables the select with a no-trashed-worlds placeholder when there are none", async () => {
    requireSupabaseClient.mockReturnValue(createSupabaseClient({ worlds: [] }));

    renderPanel(<WorldCascadeDeletePanel />);

    await screen.findByText("No trashed worlds");
    expect(screen.getByRole("combobox")).toHaveAttribute("data-disabled");
  });

  it("keeps the select enabled and lists trashed worlds when there are some", async () => {
    requireSupabaseClient.mockReturnValue(
      createSupabaseClient({
        worlds: [{ id: "w-1", name: "Riverside" }],
      }),
    );

    renderPanel(<WorldCascadeDeletePanel />);

    await screen.findByText("Select a trashed world…");
    const trigger = screen.getByRole("combobox");
    expect(trigger).not.toHaveAttribute("data-disabled");

    const user = userEvent.setup();
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Riverside" })).toBeDefined();
    });
  });
});

function renderPanel(node: ReactNode): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
}

function createSupabaseClient(fixtures: {
  readonly worlds: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
}): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "worlds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() =>
                Promise.resolve({ data: fixtures.worlds, error: null }),
              ),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}
