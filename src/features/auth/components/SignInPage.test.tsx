import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignInPage } from "./SignInPage";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

describe("SignInPage", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    requireSupabaseClient.mockReturnValue(createClient());
  });

  it("shows accessible field errors for invalid credentials", async () => {
    const user = userEvent.setup();

    renderSignInPage();
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");

    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter a valid email address.")).toBeDefined();
    expect(screen.getByText("Enter your password.")).toBeDefined();
  });

  it("shows a safe message for authentication failures", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: { message: "Database host details leaked." },
        }),
      }),
    );

    renderSignInPage();
    await user.type(screen.getByLabelText("Email"), "player@example.com");
    await user.type(screen.getByLabelText("Password"), "bad-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password is incorrect.",
    );
    expect(screen.queryByText("Database host details leaked.")).toBeNull();
  });

  it("calls the success handler after successful sign-in", async () => {
    const user = userEvent.setup();
    const onSignInSuccess = vi.fn<() => Promise<void>>().mockResolvedValue();
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
    requireSupabaseClient.mockReturnValue(createClient({ signInWithPassword }));

    renderSignInPage({ onSignInSuccess });
    await user.type(screen.getByLabelText("Email"), "player@example.com");
    await user.type(
      screen.getByLabelText("Password"),
      "correct-horse-battery-staple",
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(onSignInSuccess).toHaveBeenCalledOnce();
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "player@example.com",
      password: "correct-horse-battery-staple",
    });
  });
});

function renderSignInPage(options: Partial<SignInPageProps> = {}): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const onSignInSuccess =
    options.onSignInSuccess ?? vi.fn<() => Promise<void>>().mockResolvedValue();

  render(
    <QueryClientProvider client={queryClient}>
      <SignInPage onSignInSuccess={onSignInSuccess} />
    </QueryClientProvider>,
  );
}

type SignInPageProps = Parameters<typeof SignInPage>[0];

function createClient(
  client: { readonly signInWithPassword?: unknown } = {},
): unknown {
  return {
    auth: {
      signInWithPassword:
        client.signInWithPassword ??
        vi.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: null,
        }),
    },
  };
}
