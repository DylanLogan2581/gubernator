import { QueryClient, type MutationFunction } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { AuthUiError } from "../utils/authErrors";

import {
  signInMutationOptions,
  signOutMutationOptions,
  verifyOtpMutationOptions,
  updatePasswordMutationOptions,
} from "./authMutations";

describe("auth mutation options", () => {
  it("exposes a sign-in mutation", async () => {
    const data = { session: null, user: null };
    const signInWithPassword = vi.fn().mockResolvedValue({ data, error: null });
    const options = signInMutationOptions(createClient({ signInWithPassword }));

    expect(options.mutationKey).toEqual(["auth", "sign-in"]);
    await expect(
      runMutation(options.mutationFn, {
        email: "player@example.com",
        password: "correct-horse-battery-staple",
      }),
    ).resolves.toBe(data);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "player@example.com",
      password: "correct-horse-battery-staple",
    });
  });

  it("normalizes sign-in errors", async () => {
    const options = signInMutationOptions(
      createClient({
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: { message: "Invalid login credentials." },
        }),
      }),
    );

    await expect(
      runMutation(options.mutationFn, {
        email: "player@example.com",
        password: "bad-password",
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });

  it("exposes a sign-out mutation", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const options = signOutMutationOptions(createClient({ signOut }));

    expect(options.mutationKey).toEqual(["auth", "sign-out"]);
    await expect(
      runMutation(options.mutationFn, undefined),
    ).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("normalizes sign-out errors", async () => {
    const options = signOutMutationOptions(
      createClient({
        signOut: vi.fn().mockResolvedValue({
          error: { message: "Sign-out failed." },
        }),
      }),
    );

    await expect(
      runMutation(options.mutationFn, undefined),
    ).rejects.toBeInstanceOf(AuthUiError);
  });

  it("exposes a verify-otp mutation", async () => {
    const data = {
      session: {
        access_token: "token",
        refresh_token: "refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        user: {
          id: "user-id",
          email: "user@example.com",
          email_confirmed_at: new Date().toISOString(),
        },
      },
      user: {
        id: "user-id",
        email: "user@example.com",
      },
    };
    const verifyOtp = vi.fn().mockResolvedValue({ data, error: null });
    const options = verifyOtpMutationOptions(createClient({ verifyOtp }));

    expect(options.mutationKey).toEqual(["auth", "verify-otp"]);
    await expect(
      runMutation(options.mutationFn, {
        email: "user@example.com",
        token: "123456",
      }),
    ).resolves.toBe(data);
    expect(verifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "123456",
      type: "magiclink",
    });
  });

  it("normalizes verify-otp errors", async () => {
    const options = verifyOtpMutationOptions(
      createClient({
        verifyOtp: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Invalid OTP token." },
        }),
      }),
    );

    await expect(
      runMutation(options.mutationFn, {
        email: "user@example.com",
        token: "invalid",
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });

  it("exposes an update-password mutation", async () => {
    const data = {
      id: "user-id",
      email: "user@example.com",
      email_confirmed_at: new Date().toISOString(),
    };
    const updateUser = vi.fn().mockResolvedValue({ data, error: null });
    const options = updatePasswordMutationOptions(createClient({ updateUser }));

    expect(options.mutationKey).toEqual(["auth", "update-password"]);
    await expect(
      runMutation(options.mutationFn, {
        password: "new-password-123",
      }),
    ).resolves.toBe(data);
    expect(updateUser).toHaveBeenCalledWith({
      password: "new-password-123",
    });
  });

  it("normalizes update-password errors", async () => {
    const options = updatePasswordMutationOptions(
      createClient({
        updateUser: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Password update failed." },
        }),
      }),
    );

    await expect(
      runMutation(options.mutationFn, {
        password: "new-password",
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

function createClient(client: {
  readonly signInWithPassword?: unknown;
  readonly signOut?: unknown;
  readonly verifyOtp?: unknown;
  readonly updateUser?: unknown;
}): GubernatorSupabaseClient {
  return {
    auth: {
      signInWithPassword: client.signInWithPassword,
      signOut: client.signOut,
      verifyOtp: client.verifyOtp,
      updateUser: client.updateUser,
    },
  } as GubernatorSupabaseClient;
}

function runMutation<TVariables, TData>(
  mutationFn: MutationFunction<TData, TVariables> | undefined,
  variables: TVariables,
): Promise<TData> {
  if (mutationFn === undefined) {
    throw new Error("Expected mutation function.");
  }

  return mutationFn(variables, {
    client: new QueryClient(),
    meta: undefined,
  });
}
