import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SetPasswordPage } from "./SetPasswordPage";

const { updatePasswordMutationOptions } = vi.hoisted(() => ({
  updatePasswordMutationOptions: vi.fn(),
}));

vi.mock("@/features/auth", () => ({
  updatePasswordMutationOptions,
}));

describe("SetPasswordPage", () => {
  beforeEach(() => {
    updatePasswordMutationOptions.mockReset();
  });

  it("calls the success handler after the password is set", async () => {
    const user = userEvent.setup();
    const onPasswordSetSuccess = vi
      .fn<() => Promise<void>>()
      .mockResolvedValue();
    updatePasswordMutationOptions.mockReturnValue({
      mutationFn: () => Promise.resolve({ user: { id: "user-1" } }),
      mutationKey: ["auth", "update-password"],
    });

    renderSetPasswordPage({ onPasswordSetSuccess });
    await user.type(screen.getByLabelText("Password"), "new-password-123");
    await user.type(
      screen.getByLabelText("Confirm Password"),
      "new-password-123",
    );
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    await waitFor(() => {
      expect(onPasswordSetSuccess).toHaveBeenCalledOnce();
    });
  });

  it("shows a recovery action when the magic-link session has expired", async () => {
    const user = userEvent.setup();
    const onSessionExpired = vi.fn<() => Promise<void>>().mockResolvedValue();
    updatePasswordMutationOptions.mockReturnValue({
      mutationFn: () => Promise.reject(new Error("Auth session missing!")),
      mutationKey: ["auth", "update-password"],
    });

    renderSetPasswordPage({ onSessionExpired });
    await user.type(screen.getByLabelText("Password"), "new-password-123");
    await user.type(
      screen.getByLabelText("Confirm Password"),
      "new-password-123",
    );
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    expect(
      await screen.findByText(/your sign-up link has expired/i),
    ).toBeDefined();
    expect(screen.queryByLabelText("Password")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Return to sign in" }));
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it("shows a generic error for other failures", async () => {
    const user = userEvent.setup();
    updatePasswordMutationOptions.mockReturnValue({
      mutationFn: () => Promise.reject(new Error("Password update failed.")),
      mutationKey: ["auth", "update-password"],
    });

    renderSetPasswordPage();
    await user.type(screen.getByLabelText("Password"), "new-password-123");
    await user.type(
      screen.getByLabelText("Confirm Password"),
      "new-password-123",
    );
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    expect(await screen.findByText("Password update failed.")).toBeDefined();
  });
});

function renderSetPasswordPage(
  options: Partial<Parameters<typeof SetPasswordPage>[0]> = {},
): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const onPasswordSetSuccess =
    options.onPasswordSetSuccess ??
    vi.fn<() => Promise<void>>().mockResolvedValue();
  const onSessionExpired =
    options.onSessionExpired ??
    vi.fn<() => Promise<void>>().mockResolvedValue();

  render(
    <QueryClientProvider client={queryClient}>
      <SetPasswordPage
        onPasswordSetSuccess={onPasswordSetSuccess}
        onSessionExpired={onSessionExpired}
      />
    </QueryClientProvider>,
  );
}
