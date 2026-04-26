import { describe, expect, it } from "vitest";

import {
  getSupabaseConfigState,
  shouldBlockAppForSupabaseConfig,
} from "@/lib/supabaseConfig";

describe("getSupabaseConfigState", () => {
  it("returns configured state for browser-safe Supabase values", () => {
    const configState = getSupabaseConfigState({
      PROD: true,
      VITE_SUPABASE_ANON_KEY: "anon-key",
      VITE_SUPABASE_URL: "https://example.supabase.co",
    });

    expect(configState).toEqual({
      anonKey: "anon-key",
      isProduction: true,
      status: "configured",
      url: "https://example.supabase.co",
    });
  });

  it("reports missing VITE_ variables without reading server-only keys", () => {
    const configState = getSupabaseConfigState({
      PROD: true,
      SUPABASE_SERVICE_ROLE_KEY: "server-secret",
    } as never);

    expect(configState).toEqual({
      isProduction: true,
      message:
        "Supabase configuration is missing: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.",
      missingVariables: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
      status: "missing",
    });
  });

  it("treats blank values as missing", () => {
    const configState = getSupabaseConfigState({
      PROD: false,
      VITE_SUPABASE_ANON_KEY: " ",
      VITE_SUPABASE_URL: "",
    });

    expect(configState).toMatchObject({
      missingVariables: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
      status: "missing",
    });
  });
});

describe("shouldBlockAppForSupabaseConfig", () => {
  it("blocks production when Supabase is missing", () => {
    const configState = getSupabaseConfigState({ PROD: true });

    expect(shouldBlockAppForSupabaseConfig(configState)).toBe(true);
  });

  it("allows local development to render without Supabase config", () => {
    const configState = getSupabaseConfigState({ PROD: false });

    expect(shouldBlockAppForSupabaseConfig(configState)).toBe(false);
  });
});
