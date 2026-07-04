import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TrashedDepositTypeRow } from "./TrashedDepositTypeRow";

import type { DepositType } from "../../types/depositTypes";

const { hardDeleteMutationFn, restoreMutationFn } = vi.hoisted(() => ({
  hardDeleteMutationFn: vi.fn().mockResolvedValue(undefined),
  restoreMutationFn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../mutations/depositsMutations", () => ({
  hardDeleteDepositTypeMutationOptions: () => ({
    mutationFn: hardDeleteMutationFn,
  }),
  restoreDepositTypeMutationOptions: () => ({
    mutationFn: restoreMutationFn,
  }),
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000001";

describe("TrashedDepositTypeRow", () => {
  it("opens a confirm dialog naming the deposit type when delete permanently is clicked", async () => {
    const user = userEvent.setup();
    renderRow(createDepositType({ name: "Iron Vein" }));

    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Permanently delete Iron Vein?",
    });
    expect(dialog).toHaveTextContent(/cannot be undone/i);
    expect(hardDeleteMutationFn).not.toHaveBeenCalled();
  });

  it("does not call the hard-delete mutation when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    renderRow(createDepositType({ name: "Iron Vein" }));

    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Permanently delete Iron Vein?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("alertdialog", {
          name: "Permanently delete Iron Vein?",
        }),
      ).toBeNull();
    });
    expect(hardDeleteMutationFn).not.toHaveBeenCalled();
  });

  it("calls the hard-delete mutation only after the dialog is confirmed", async () => {
    const user = userEvent.setup();
    renderRow(createDepositType({ id: "deposit-1", name: "Iron Vein" }));

    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Permanently delete Iron Vein?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Delete permanently" }),
    );

    await waitFor(() => {
      expect(hardDeleteMutationFn).toHaveBeenCalledTimes(1);
    });
    expect(hardDeleteMutationFn.mock.calls[0]?.[0]).toStrictEqual({
      depositTypeId: "deposit-1",
      worldId: WORLD_ID,
    });
  });
});

function renderRow(depositType: DepositType): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <TrashedDepositTypeRow
        depositType={depositType}
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

function createDepositType(overrides: Partial<DepositType> = {}): DepositType {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    hasActiveReferences: false,
    id: "00000000-0000-0000-0000-000000000002",
    isTrashed: true,
    jobId: "00000000-0000-0000-0000-000000000003",
    name: "Test Deposit",
    outputUnitsPerWorker: 4,
    slug: "test-deposit",
    updatedAt: "2026-01-01T00:00:00.000Z",
    workerInputsJson: [],
    worldId: WORLD_ID,
    ...overrides,
  };
}
