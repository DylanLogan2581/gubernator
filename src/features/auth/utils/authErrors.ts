import { isAuthError } from "@supabase/supabase-js";

import { SupabaseConfigurationError } from "@/lib/supabaseConfig";

import type { AuthErrorDetails } from "../types/authTypes";

export class AuthUiError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor({ code, message, status }: AuthErrorDetails) {
    super(message);
    this.name = "AuthUiError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeAuthError(error: unknown): AuthUiError {
  if (error instanceof AuthUiError) {
    return error;
  }

  if (isAuthError(error)) {
    return new AuthUiError({
      code: error.code,
      message: error.message,
      status: error.status,
    });
  }

  if (error instanceof SupabaseConfigurationError) {
    return new AuthUiError({
      code: "supabase_configuration_missing",
      message: error.message,
    });
  }

  if (isPostgrestLikeError(error)) {
    return new AuthUiError({
      code: error.code,
      message: error.message,
    });
  }

  if (error instanceof Error) {
    return new AuthUiError({ message: error.message });
  }

  return new AuthUiError({ message: "Authentication failed." });
}

function isPostgrestLikeError(
  error: unknown,
): error is { code?: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  );
}
