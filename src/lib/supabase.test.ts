import { describe, expect, it, vi } from "vitest";

import {
  createSupabaseBrowserClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { SupabaseConfigurationError } from "@/lib/supabaseConfig";

describe("createSupabaseBrowserClient", () => {
  it("creates a client when Supabase config is present", () => {
    const expectedClient = {} as GubernatorSupabaseClient;
    const client = createSupabaseBrowserClient(
      {
        anonKey: "anon-key",
        isProduction: true,
        status: "configured",
        url: "https://example.supabase.co",
      },
      (url, anonKey) => {
        expect(url).toBe("https://example.supabase.co");
        expect(anonKey).toBe("anon-key");

        return expectedClient;
      },
    );

    expect(client).toBe(expectedClient);
  });

  it("returns null for missing local development config", () => {
    const client = createSupabaseBrowserClient({
      isProduction: false,
      message:
        "Supabase configuration is missing: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.",
      missingVariables: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
      status: "missing",
    });

    expect(client).toBeNull();
  });

  it("throws a clear configuration error for missing production config", () => {
    expect(() =>
      createSupabaseBrowserClient({
        isProduction: true,
        message:
          "Supabase configuration is missing: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.",
        missingVariables: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
        status: "missing",
      }),
    ).toThrow(SupabaseConfigurationError);
  });

  it("does not create a browser client for unconfigured local development", () => {
    const clientFactory = vi.fn();

    const client = createSupabaseBrowserClient(
      {
        isProduction: false,
        message:
          "Supabase configuration is missing: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.",
        missingVariables: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
        status: "missing",
      },
      clientFactory,
    );

    expect(client).toBeNull();
    expect(clientFactory).not.toHaveBeenCalled();
  });
});
