import {
  mutationOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";

import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { authQueryKeys } from "../queries/authQueryKeys";
import { normalizeAuthError } from "../utils/authErrors";

import type { SignInWithPasswordInput } from "../types/authTypes";
import type { AuthUiError } from "../utils/authErrors";

type SignInResult = Awaited<
  ReturnType<GubernatorSupabaseClient["auth"]["signInWithPassword"]>
>["data"];
type SignInMutationOptions = UseMutationOptions<
  SignInResult,
  AuthUiError,
  SignInWithPasswordInput
>;
type SignOutMutationOptions = UseMutationOptions<void, AuthUiError, void>;

export function signInMutationOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SignInMutationOptions {
  return mutationOptions({
    mutationFn: (credentials: SignInWithPasswordInput) =>
      signInWithPassword(client, credentials),
    mutationKey: [...authQueryKeys.all, "sign-in"] as const,
  });
}

export function signOutMutationOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SignOutMutationOptions {
  return mutationOptions({
    mutationFn: () => signOut(client),
    mutationKey: [...authQueryKeys.all, "sign-out"] as const,
  });
}

async function signInWithPassword(
  client: GubernatorSupabaseClient,
  credentials: SignInWithPasswordInput,
): Promise<SignInResult> {
  const { data, error } = await client.auth.signInWithPassword(credentials);

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data;
}

async function signOut(client: GubernatorSupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();

  if (error !== null) {
    throw normalizeAuthError(error);
  }
}
