import {
  mutationOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";

import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { authQueryKeys } from "../queries/authQueryKeys";
import { normalizeSupabaseError } from "../utils/authErrors";

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

type VerifyOtpInput = {
  email: string;
  token: string;
};
type VerifyOtpResult = Awaited<
  ReturnType<GubernatorSupabaseClient["auth"]["verifyOtp"]>
>["data"];
type VerifyOtpMutationOptions = UseMutationOptions<
  VerifyOtpResult,
  AuthUiError,
  VerifyOtpInput
>;

type UpdatePasswordInput = {
  password: string;
};
type UpdatePasswordResult = Awaited<
  ReturnType<GubernatorSupabaseClient["auth"]["updateUser"]>
>["data"];
type UpdatePasswordMutationOptions = UseMutationOptions<
  UpdatePasswordResult,
  AuthUiError,
  UpdatePasswordInput
>;

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

export function verifyOtpMutationOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): VerifyOtpMutationOptions {
  return mutationOptions({
    mutationFn: (input: VerifyOtpInput) => verifyOtp(client, input),
    mutationKey: [...authQueryKeys.all, "verify-otp"] as const,
  });
}

export function updatePasswordMutationOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UpdatePasswordMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdatePasswordInput) => updatePassword(client, input),
    mutationKey: [...authQueryKeys.all, "update-password"] as const,
  });
}

async function signInWithPassword(
  client: GubernatorSupabaseClient,
  credentials: SignInWithPasswordInput,
): Promise<SignInResult> {
  const { data, error } = await client.auth.signInWithPassword(credentials);

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}

async function signOut(client: GubernatorSupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}

async function verifyOtp(
  client: GubernatorSupabaseClient,
  input: VerifyOtpInput,
): Promise<VerifyOtpResult> {
  const { data, error } = await client.auth.verifyOtp({
    email: input.email,
    token: input.token,
    type: "magiclink",
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}

async function updatePassword(
  client: GubernatorSupabaseClient,
  input: UpdatePasswordInput,
): Promise<UpdatePasswordResult> {
  const { data, error } = await client.auth.updateUser({
    password: input.password,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}
