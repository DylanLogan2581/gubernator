import { QueryClient, type MutationFunction } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { AuthUiError } from "../utils/authErrors";

import { signInMutationOptions, signOutMutationOptions } from "./authMutations";

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
});

function createClient(client: {
  readonly signInWithPassword?: unknown;
  readonly signOut?: unknown;
}): GubernatorSupabaseClient {
  return {
    auth: {
      signInWithPassword: client.signInWithPassword,
      signOut: client.signOut,
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
