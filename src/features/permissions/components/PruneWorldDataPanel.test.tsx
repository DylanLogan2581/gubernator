import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

import { PruneWorldDataPanel } from "./PruneWorldDataPanel";

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

const WORLDS = [{ id: "w-1", name: "Riverside" }] as const;

describe("PruneWorldDataPanel retention configuration", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("leaves fields empty with default placeholders and no-ops on save when no config row exists", async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: null }));
    requireSupabaseClient.mockReturnValue(createSupabaseClient(null, upsert));

    renderPanel();
    const user = userEvent.setup();
    await selectWorld(user);

    const logInput = await screen.findByLabelText("Log retention (turns)");
    const snapshotInput = screen.getByLabelText("Snapshot retention (turns)");
    expect(logInput).toHaveValue(null);
    expect(snapshotInput).toHaveValue(null);
    expect(logInput).toHaveAttribute("placeholder", "200 (default)");
    expect(snapshotInput).toHaveAttribute("placeholder", "200 (default)");

    expect(
      screen.getByRole("button", { name: "Save retention settings" }),
    ).toBeDisabled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("persists an explicit value and persists cleared fields as null", async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: null }));
    requireSupabaseClient.mockReturnValue(
      createSupabaseClient(
        {
          log_retention_turns: 50,
          memory_retention_turns: null,
          snapshot_retention_turns: 75,
        },
        upsert,
      ),
    );

    renderPanel();
    const user = userEvent.setup();
    await selectWorld(user);

    const logInput = await screen.findByLabelText("Log retention (turns)");
    expect(logInput).toHaveValue(50);

    await user.clear(logInput);
    await user.type(logInput, "10");
    await user.clear(screen.getByLabelText("Snapshot retention (turns)"));
    await user.click(
      screen.getByRole("button", { name: "Save retention settings" }),
    );

    expect(upsert).toHaveBeenCalledWith(
      {
        log_retention_turns: 10,
        memory_retention_turns: null,
        snapshot_retention_turns: null,
        world_id: "w-1",
      },
      { onConflict: "world_id" },
    );
  });
});

async function selectWorld(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: "Riverside" }));
}

function renderPanel(
  node: ReactNode = <PruneWorldDataPanel worlds={WORLDS} />,
): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
}

function createSupabaseClient(
  row: {
    readonly log_retention_turns: number | null;
    readonly memory_retention_turns: number | null;
    readonly snapshot_retention_turns: number | null;
  } | null,
  upsert: () => Promise<{ readonly error: null }>,
): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "world_retention_config") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({ data: row, error: null }),
              ),
            })),
          })),
          upsert,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}
