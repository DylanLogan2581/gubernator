import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
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

  it("removes the world from the dropdown after a successful hard delete without reload", async () => {
    requireSupabaseClient.mockReturnValue(
      createSupabaseClient({
        worlds: [
          { id: "11111111-1111-4111-8111-111111111111", name: "Riverside" },
        ],
      }),
    );

    renderPanel(<WorldCascadeDeletePanel />);

    const user = userEvent.setup();

    await screen.findByText("Select a trashed world…");
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Riverside" }));

    await user.click(screen.getByRole("button", { name: "Preview cascade" }));
    await user.click(
      await screen.findByRole("button", { name: "Delete world" }),
    );

    // Confirm in the dialog.
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete world" }),
    );

    await screen.findByText("No trashed worlds");
    expect(screen.queryByText("Riverside")).toBeNull();
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
  const worlds = [...fixtures.worlds];

  return {
    from: vi.fn((table: string) => {
      if (table === "worlds") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() =>
                Promise.resolve({ data: [...worlds], error: null }),
              ),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn((fn: string, params: { readonly p_world_id: string }) => {
      if (fn === "preview_world_delete") {
        return Promise.resolve({
          data: {
            worldName: "Riverside",
            nations: 0,
            settlements: 0,
            citizens: 0,
            resources: 0,
            turnTransitions: 0,
            eventGroups: 0,
            worldAdmins: 0,
            notifications: 0,
            settlementTurnSnapshots: 0,
            turnLogEntries: 0,
          },
          error: null,
        });
      }
      if (fn === "hard_delete_world") {
        const index = worlds.findIndex((w) => w.id === params.p_world_id);
        if (index !== -1) worlds.splice(index, 1);
        return {
          maybeSingle: vi.fn(() =>
            Promise.resolve({
              data: { id: params.p_world_id },
              error: null,
            }),
          ),
        };
      }
      throw new Error(`Unexpected rpc ${fn}`);
    }),
  };
}
