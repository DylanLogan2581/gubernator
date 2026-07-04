import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TrashedManagedPopulationTypeRow } from "./TrashedManagedPopulationTypeRow";

import type { ManagedPopulationType } from "../../../types/managedPopulationTypes";

const { hardDeleteMutationFn, restoreMutationFn } = vi.hoisted(() => ({
  hardDeleteMutationFn: vi.fn().mockResolvedValue(undefined),
  restoreMutationFn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../mutations/managedPopulationsMutations", () => ({
  hardDeleteManagedPopulationTypeMutationOptions: () => ({
    mutationFn: hardDeleteMutationFn,
  }),
  restoreManagedPopulationTypeMutationOptions: () => ({
    mutationFn: restoreMutationFn,
  }),
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000001";

describe("TrashedManagedPopulationTypeRow", () => {
  it("opens a confirm dialog naming the population type when delete permanently is clicked", async () => {
    const user = userEvent.setup();
    renderRow(createPopulationType({ name: "Cattle" }));

    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Permanently delete Cattle?",
    });
    expect(dialog).toHaveTextContent(/cannot be undone/i);
    expect(hardDeleteMutationFn).not.toHaveBeenCalled();
  });

  it("does not call the hard-delete mutation when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    renderRow(createPopulationType({ name: "Cattle" }));

    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Permanently delete Cattle?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("alertdialog", {
          name: "Permanently delete Cattle?",
        }),
      ).toBeNull();
    });
    expect(hardDeleteMutationFn).not.toHaveBeenCalled();
  });

  it("calls the hard-delete mutation only after the dialog is confirmed", async () => {
    const user = userEvent.setup();
    renderRow(createPopulationType({ id: "population-1", name: "Cattle" }));

    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Permanently delete Cattle?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Delete permanently" }),
    );

    await waitFor(() => {
      expect(hardDeleteMutationFn).toHaveBeenCalledTimes(1);
    });
    expect(hardDeleteMutationFn.mock.calls[0]?.[0]).toStrictEqual({
      managedPopulationTypeId: "population-1",
      worldId: WORLD_ID,
    });
  });
});

function renderRow(populationType: ManagedPopulationType): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <TrashedManagedPopulationTypeRow
        populationType={populationType}
        queryClient={createQueryClient()}
        worldId={WORLD_ID}
      />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function createPopulationType(
  overrides: Partial<ManagedPopulationType> = {},
): ManagedPopulationType {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    cullingJobId: "00000000-0000-0000-0000-000000000004",
    cullingOutputsJson: [],
    growthRate: 0.05,
    hasActiveReferences: false,
    husbandryJobId: "00000000-0000-0000-0000-000000000003",
    husbandryWorkersPerNAnimals: 2,
    icon: null,
    id: "00000000-0000-0000-0000-000000000002",
    isTrashed: true,
    maintenanceRulesJson: [],
    name: "Test Population",
    regularOutputsJson: [],
    slug: "test-population",
    updatedAt: "2026-01-01T00:00:00.000Z",
    worldId: WORLD_ID,
    ...overrides,
  };
}
