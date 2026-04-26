import { AuthError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { SupabaseConfigurationError } from "@/lib/supabaseConfig";

import { AuthUiError, normalizeAuthError } from "./authErrors";

describe("normalizeAuthError", () => {
  it("preserves normalized auth UI errors", () => {
    const error = new AuthUiError({
      code: "already_normalized",
      message: "Already normalized.",
      status: 400,
    });

    expect(normalizeAuthError(error)).toBe(error);
  });

  it("normalizes Supabase auth errors", () => {
    const error = normalizeAuthError(
      new AuthError("Invalid credentials.", 400, "invalid_credentials"),
    );

    expect(error).toMatchObject({
      code: "invalid_credentials",
      message: "Invalid credentials.",
      name: "AuthUiError",
      status: 400,
    });
  });

  it("normalizes PostgREST-shaped errors", () => {
    const error = normalizeAuthError({
      code: "PGRST116",
      message: "Cannot coerce the result to a single JSON object.",
    });

    expect(error).toMatchObject({
      code: "PGRST116",
      message: "Cannot coerce the result to a single JSON object.",
    });
  });

  it("normalizes Supabase configuration errors", () => {
    const error = normalizeAuthError(
      new SupabaseConfigurationError({
        isProduction: true,
        message:
          "Supabase configuration is missing: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.",
        missingVariables: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
        status: "missing",
      }),
    );

    expect(error).toMatchObject({
      code: "supabase_configuration_missing",
      message:
        "Supabase configuration is missing: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.",
    });
  });

  it("uses a generic message for unknown thrown values", () => {
    expect(normalizeAuthError(null).message).toBe("Authentication failed.");
  });
});
