import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MutationConfirmDialog,
  type MutationSuccessNotice,
} from "./MutationConfirmDialog";

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn<(message: string) => void>(),
  toastSuccess:
    vi.fn<(message: string, options?: { description?: string }) => void>(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

type Input = { readonly id: string };
type Result = { readonly count: number };

function renderDialog({
  mutationFn = vi.fn<(input: Input) => Promise<Result>>(() =>
    Promise.resolve({ count: 0 }),
  ),
  onClose = vi.fn<() => void>(),
  successMessage = "It worked.",
}: {
  readonly mutationFn?: (input: Input) => Promise<Result>;
  readonly onClose?: () => void;
  readonly successMessage?:
    | MutationSuccessNotice
    | ((result: Result) => MutationSuccessNotice);
} = {}): {
  readonly mutationFn: (input: Input) => Promise<Result>;
  readonly onClose: () => void;
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MutationConfirmDialog
        confirmLabel="Delete"
        description="This cannot be undone."
        errorFallback="Failed to delete thing."
        input={{ id: "thing-1" }}
        mutationOptions={{ mutationFn }}
        onClose={onClose}
        successMessage={successMessage}
        title="Delete thing?"
      />
    </QueryClientProvider>,
  );
  return { mutationFn, onClose };
}

describe("MutationConfirmDialog", () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("renders title, description, and confirm label", () => {
    renderDialog();
    expect(
      screen.getByRole("alertdialog", { name: "Delete thing?" }),
    ).toBeDefined();
    expect(screen.getByText("This cannot be undone.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
  });

  it("runs the mutation with input, notifies success, and closes", async () => {
    const user = userEvent.setup();
    const { mutationFn, onClose } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("It worked.", undefined);
    });
    expect(mutationFn).toHaveBeenCalledOnce();
    expect(vi.mocked(mutationFn).mock.calls[0]?.[0]).toEqual({
      id: "thing-1",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("derives the success notice from the mutation result", async () => {
    const user = userEvent.setup();
    renderDialog({
      mutationFn: vi.fn(() => Promise.resolve({ count: 3 })),
      successMessage: (result) => ({
        message: "It worked.",
        description: `${result.count.toString()} things affected.`,
      }),
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("It worked.", {
        description: "3 things affected.",
      });
    });
  });

  it("notifies the error and stays open when the mutation fails", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({
      mutationFn: vi.fn(() => Promise.reject(new Error("boom"))),
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("boom");
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancel calls onClose without running the mutation", async () => {
    const user = userEvent.setup();
    const { mutationFn, onClose } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(mutationFn).not.toHaveBeenCalled();
  });
});
