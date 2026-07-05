import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useHardDeleteRow } from "./useHardDeleteRow";

import type { UseMutationOptions } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function Wrapper({
  children,
  queryClient,
}: {
  readonly children?: ReactNode;
  readonly queryClient: QueryClient;
}): ReactNode {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useHardDeleteRow", () => {
  it("still calls the wrapped mutation's onSuccess (e.g. cache invalidation) alongside the toast", async () => {
    const onSuccess = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const mutationOptions: UseMutationOptions<
      { readonly id: string },
      Error,
      void
    > = {
      mutationFn: () => Promise.resolve({ id: "1" }),
      onSuccess,
    };

    const { result } = renderHook(
      () => useHardDeleteRow(mutationOptions, { successMessage: "Deleted." }),
      { wrapper: (props) => <Wrapper {...props} queryClient={queryClient} /> },
    );

    result.current.mutate();

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("still calls the wrapped mutation's onError alongside the toast", async () => {
    const onError = vi.fn();
    const error = new Error("boom");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const mutationOptions: UseMutationOptions<void, Error, void> = {
      mutationFn: () => Promise.reject(error),
      onError,
    };

    const { result } = renderHook(
      () => useHardDeleteRow(mutationOptions, { successMessage: "Deleted." }),
      { wrapper: (props) => <Wrapper {...props} queryClient={queryClient} /> },
    );

    result.current.mutate();

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });
});
