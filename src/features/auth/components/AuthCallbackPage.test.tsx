import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthCallbackPage } from "./AuthCallbackPage";

const { currentSessionQueryOptions } = vi.hoisted(() => ({
  currentSessionQueryOptions: vi.fn(),
}));

vi.mock("@/features/auth", () => ({
  currentSessionQueryOptions,
}));

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    currentSessionQueryOptions.mockReset();
  });

  it("navigates once the session resolves, without re-navigating on rerenders", async () => {
    const onSessionVerified = vi.fn<() => Promise<void>>().mockResolvedValue();
    const onError = vi.fn<() => Promise<void>>().mockResolvedValue();
    currentSessionQueryOptions.mockReturnValue({
      queryFn: () => Promise.resolve({ user: { id: "user-1" } }),
      queryKey: ["auth", "current-session"],
    });

    const { rerender } = renderCallback({ onError, onSessionVerified });

    await waitFor(() => {
      expect(onSessionVerified).toHaveBeenCalledOnce();
    });

    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <AuthCallbackPage
          onError={onError}
          onSessionVerified={onSessionVerified}
        />
      </QueryClientProvider>,
    );

    expect(onSessionVerified).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it("shows an error and offers a return-to-sign-in action when there is no session", async () => {
    const user = userEvent.setup();
    const onSessionVerified = vi.fn<() => Promise<void>>().mockResolvedValue();
    const onError = vi.fn<() => Promise<void>>().mockResolvedValue();
    currentSessionQueryOptions.mockReturnValue({
      queryFn: () => Promise.resolve(null),
      queryKey: ["auth", "current-session"],
    });

    renderCallback({ onError, onSessionVerified });

    await user.click(
      await screen.findByRole("button", { name: "Return to sign in" }),
    );

    expect(onSessionVerified).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function renderCallback(props: {
  readonly onError: () => Promise<void>;
  readonly onSessionVerified: () => Promise<void>;
}): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthCallbackPage
        onError={props.onError}
        onSessionVerified={props.onSessionVerified}
      />
    </QueryClientProvider>,
  );
}
